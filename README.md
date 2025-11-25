# Medical Appointment Backend

Backend para un sistema de agendamiento de citas médicas, diseñado con una arquitectura distribuida que integra API Gateway, SNS, SQS, EventBridge y múltiples bases de datos optimizadas para garantizar alto rendimiento, escalabilidad y resiliencia.

## 📋 Tabla de Contenidos

- [Introducción](#-introducción)
- [Arquitectura General](#-arquitectura-general)
- [Diagrama Mermaid](#-diagrama-mermaid)
- [Flujo Técnico Detallado](#-flujo-técnico-detallado)
- [Casos de Uso](#-casos-de-uso)
- [Documentación de Uso (API)](#-documentación-de-uso-api)
- [Pruebas E2E](#-pruebas-e2e)
- [Documentación OpenAPI](#-documentación-openapi)
- [Variables de Entorno](#-variables-de-entorno)
- [Instalación y Despliegue](#-instalación-y-despliegue)
- [URLs del Servicio](#-urls-del-servicio)
- [Repositorio Público](#-repositorio-público)
- [Pruebas Unitarias](#-pruebas-unitarias)
- [Cómo Explicar el Reto en Entrevista](#-cómo-explicar-el-reto-en-entrevista)
- [Entrega Final](#-entrega-final)
- [Mejoras Futuras](#-mejoras-futuras)

## 🎯 Introducción

Este proyecto implementa un sistema backend serverless para el agendamiento de citas médicas con soporte multi-país (Perú y Chile). La solución está construida sobre AWS utilizando una arquitectura de microservicios distribuida que garantiza alta disponibilidad, escalabilidad automática y procesamiento asíncrono.

### Características Principales

- **Arquitectura Serverless**: Implementado con AWS Lambda y API Gateway
- **Separación por País**: Procesamiento independiente para Perú (PE) y Chile (CL)
- **Múltiples Bases de Datos**: DynamoDB para consultas rápidas y RDS MySQL para persistencia por país
- **Mensajería Asíncrona**: SNS, SQS y EventBridge para comunicación entre servicios
- **Escalabilidad**: Diseño que se adapta automáticamente a la carga
- **Resiliencia**: Dead Letter Queues (DLQ) para manejo de errores
- **Clean Architecture**: Separación de capas siguiendo principios SOLID

### Stack Tecnológico

- **Runtime**: Node.js 20.x
- **Framework**: Serverless Framework 4.x
- **Lenguaje**: TypeScript 5.x
- **Bases de Datos**: DynamoDB, RDS MySQL (con Prisma ORM)
- **Servicios AWS**: Lambda, API Gateway, SNS, SQS, EventBridge, VPC
- **Herramientas**: Prisma, Jest, Joi

## 🏗️ Arquitectura General

La arquitectura del sistema está diseñada siguiendo los principios de Clean Architecture y separación de responsabilidades. El sistema se divide en cuatro capas principales:

### Capas de la Arquitectura

1. **Capa de Dominio**: Contiene las entidades y reglas de negocio puras, independientes de frameworks y tecnologías específicas.

2. **Capa de Aplicación**: Contiene los casos de uso que orquestan las operaciones de negocio, definiendo la lógica de la aplicación sin depender de detalles de implementación.

3. **Capa de Infraestructura**: Contiene las implementaciones concretas de repositorios y servicios de mensajería (DynamoDB, RDS, SNS, SQS, EventBridge).

4. **Capa de Interfaces**: Contiene los puntos de entrada del sistema (handlers de Lambda, validadores HTTP, DTOs).

### Principios de Diseño Aplicados

- **Clean Architecture**: Separación de capas con dependencias hacia adentro
- **SOLID**: Principios de diseño orientado a objetos aplicados en toda la arquitectura
- **Dependency Injection**: Inyección de dependencias para desacoplar componentes
- **Repository Pattern**: Abstracción del acceso a datos mediante interfaces

## 📊 Diagrama Mermaid

```mermaid
graph TB
    Client[Cliente] -->|HTTP Request| APIGateway[API Gateway]
    
    APIGateway -->|Invoca| LambdaAppointment[Lambda: appointment]
    
    LambdaAppointment -->|Guarda/Consulta| DynamoDB[(DynamoDB)]
    LambdaAppointment -->|Publica evento| SNSTopic[SNS Topic]
    
    SNSTopic -->|Distribuye| SQS_PE[SQS_PE<br/>Cola Perú]
    SNSTopic -->|Distribuye| SQS_CL[SQS_CL<br/>Cola Chile]
    
    SQS_PE -->|Consume| LambdaAppointmentPE[Lambda: appointmentPe]
    SQS_CL -->|Consume| LambdaAppointmentCL[Lambda: appointmentCl]
    
    LambdaAppointmentPE -->|Persiste| RDS_PE[(RDS PE<br/>Perú)]
    LambdaAppointmentCL -->|Persiste| RDS_CL[(RDS CL<br/>Chile)]
    
    LambdaAppointmentPE -->|Publica evento| EventBridge[EventBridge]
    LambdaAppointmentCL -->|Publica evento| EventBridge
    
    EventBridge -->|Envía confirmación| SQS_CONFIRMATION[SQS_CONFIRMATION]
    
    SQS_CONFIRMATION -->|Consume| LambdaAppointmentUpdate[Lambda: appointment<br/>Actualiza Estado]
    
    LambdaAppointmentUpdate -->|Actualiza estado| DynamoDB
    
    style APIGateway fill:#FF9900
    style LambdaAppointment fill:#FF9900
    style LambdaAppointmentPE fill:#FF9900
    style LambdaAppointmentCL fill:#FF9900
    style LambdaAppointmentUpdate fill:#FF9900
    style DynamoDB fill:#4053D6
    style RDS_PE fill:#4053D6
    style RDS_CL fill:#4053D6
    style SNSTopic fill:#F58536
    style SQS_PE fill:#F58536
    style SQS_CL fill:#F58536
    style SQS_CONFIRMATION fill:#F58536
    style EventBridge fill:#FF9900
```

## 🔄 Flujo Técnico Detallado

### Flujo de Creación de Cita (POST /appointments)

1. **Recepción de Petición HTTP**: El cliente envía una petición POST a través del API Gateway con los datos de la cita (`insuredId`, `scheduleId`, `countryISO`).

2. **Validación en Capa de Interfaz**: El handler de Lambda valida los datos de entrada utilizando el esquema Joi `createAppointmentSchema`. Si la validación falla, se retorna un error HTTP 400.

3. **Ejecución del Caso de Uso**: Se invoca `CreateAppointmentUseCase` que:
   - Genera un `appointmentId` único mediante UUID v4
   - Crea timestamps `createdAt` y `updatedAt` en formato ISO 8601
   - Instancia la entidad de dominio `Appointment` con estado `"pending"`

4. **Persistencia Inicial en DynamoDB**: Se ejecuta `AppointmentDynamoRepository.createPending()` que realiza un `PutItem` en DynamoDB. Esto permite que la cita sea consultable inmediatamente.

5. **Publicación de Evento SNS**: Se publica el evento `AppointmentRequestedEvent` al SNS Topic mediante `AppointmentRequestedPublisher`. El mensaje incluye el atributo `countryISO` para enrutamiento automático.

6. **Respuesta al Cliente**: Se retorna una respuesta HTTP 201 con el `appointmentId` generado y el estado `"pending"`.

### Flujo de Procesamiento Asíncrono por País

1. **Distribución por SNS**: El SNS Topic distribuye automáticamente el mensaje a las colas SQS correspondientes:
   - Si `countryISO === "PE"` → SQS_PE
   - Si `countryISO === "CL"` → SQS_CL

2. **Consumo de Mensaje SQS**: La Lambda correspondiente (`appointmentPe` o `appointmentCl`) es invocada por SQS con el mensaje.

3. **Parseo del Mensaje**: Se parsea el cuerpo del mensaje SQS que contiene una notificación SNS. El mensaje real se encuentra en el campo `Message`.

4. **Construcción de Entidad**: Se instancia la entidad `Appointment` con los datos extraídos del mensaje.

5. **Persistencia en RDS**: Se ejecuta `AppointmentMySQLRepository.saveToRds()` que utiliza Prisma ORM para insertar la cita en la base de datos MySQL del país correspondiente.

6. **Publicación de Evento EventBridge**: Se ejecuta `PublishAppointmentCompletedUseCase` que publica el evento `AppointmentCompletedEvent` en EventBridge. Esta operación es no bloqueante.

### Flujo de Actualización de Estado

1. **Recepción de Confirmación**: EventBridge envía el evento de confirmación a la cola SQS_CONFIRMATION.

2. **Consumo de Mensaje**: La Lambda `appointment` (en modo SQS) consume el mensaje de SQS_CONFIRMATION.

3. **Parseo del Mensaje**: Se parsea el mensaje que puede venir en formato EventBridge (campo `detail`) o formato SNS (campo `Message`).

4. **Actualización en DynamoDB**: Se ejecuta `CompleteAppointmentUseCase` que invoca `AppointmentDynamoRepository.markCompleted()`, realizando un `UpdateItem` en DynamoDB para cambiar el estado de `"pending"` a `"completed"`.

### Flujo de Consulta de Citas (GET /appointments/{insuredId})

1. **Recepción de Petición HTTP**: El cliente envía una petición GET con el `insuredId` como parámetro de ruta.

2. **Validación**: Se valida que el `insuredId` esté presente. Si falta, se retorna un error HTTP 400.

3. **Ejecución del Caso de Uso**: Se invoca `GetAppointmentsByInsuredUseCase` que:
   - Ejecuta `AppointmentDynamoRepository.findByInsuredId()`
   - Realiza una operación `Query` en DynamoDB utilizando `insuredId` como clave de partición
   - Retorna todas las citas asociadas al asegurado

4. **Respuesta al Cliente**: Se retorna una respuesta HTTP 200 con el listado de citas, incluyendo su estado actual (`pending` o `completed`).

## 📘 Casos de Uso

Esta sección documenta los casos de uso principales del sistema a nivel de negocio y lógica, siguiendo los principios de Clean Architecture, SOLID y separación de responsabilidades.

### 1. CreateAppointmentUseCase

#### Propósito

Crear una nueva cita médica en el sistema, orquestando la creación de la entidad de dominio, su persistencia inicial en DynamoDB y la publicación de un evento asíncrono para el procesamiento posterior según el país correspondiente.

#### Entradas

- **`insuredId`** (string, requerido): Identificador único del asegurado
- **`scheduleId`** (number, requerido): Identificador numérico del horario seleccionado
- **`countryISO`** (string, requerido): Código ISO del país ("PE" o "CL")

#### Salidas

- **Entidad `Appointment`** con:
  - `appointmentId`: UUID v4 generado
  - `insuredId`, `scheduleId`, `countryISO`: Valores proporcionados
  - `status`: "pending"
  - `createdAt`, `updatedAt`: Timestamps ISO 8601

#### Flujo Interno

1. Generación de `appointmentId` mediante UUID v4
2. Creación de timestamps ISO 8601
3. Construcción de la entidad de dominio `Appointment`
4. Persistencia en DynamoDB con estado `"pending"`
5. Publicación del evento `AppointmentRequestedEvent` al SNS Topic
6. Retorno de la entidad creada

#### Interacciones AWS

- **DynamoDB**: `PutItem` en la tabla de citas
- **SNS**: Publicación de mensaje al Topic con atributo `countryISO` para enrutamiento

---

### 2. ProcessCountryAppointmentUseCase (PE y CL)

#### Propósito

Procesar citas médicas distribuidas por el sistema de mensajería según el país correspondiente, persistiendo la información en la base de datos MySQL del país específico y publicando un evento de confirmación.

**Nota**: La lógica está encapsulada en los handlers de las Lambdas `appointmentPe` y `appointmentCl`.

#### Entradas

- **Mensaje SQS** de las colas SQS_PE o SQS_CL
- **Estructura del Mensaje**: Contiene objeto SNS con campo `Message` que incluye `appointmentId`, `insuredId`, `scheduleId`, `countryISO`

#### Salidas

- Estado HTTP 200 si el procesamiento fue exitoso
- Cita persistida en MySQL del país correspondiente
- Evento `AppointmentCompletedEvent` publicado en EventBridge

#### Flujo Interno

1. Recepción del evento SQS con uno o más registros
2. Validación de presencia de registros
3. Para cada registro:
   - Parseo del mensaje SNS
   - Extracción de datos de la cita
   - Construcción de la entidad `Appointment`
   - Persistencia en MySQL mediante Prisma ORM
   - Publicación de evento en EventBridge (no bloqueante)

#### Interacciones AWS

- **SQS**: Consumo de mensajes de SQS_PE o SQS_CL
- **MySQL (RDS)**: `INSERT` en la tabla de citas del país
- **EventBridge**: Publicación de evento `AppointmentCompletedEvent`

---

### 3. CompleteAppointmentUseCase

#### Propósito

Actualizar el estado de una cita médica de `"pending"` a `"completed"` en DynamoDB cuando se recibe confirmación de que la cita ha sido procesada exitosamente en la base de datos MySQL.

#### Entradas

- **`appointmentId`** (string, requerido): Identificador único de la cita
- **`insuredId`** (string, requerido): Identificador del asegurado (clave de partición en DynamoDB)

#### Salidas

- Void (actualiza el estado en DynamoDB)

#### Flujo Interno

1. Recepción de `appointmentId` y `insuredId`
2. Invocación de `AppointmentDynamoRepository.markCompleted()`
3. Ejecución de `UpdateItem` en DynamoDB:
   - Identificación mediante clave compuesta (`insuredId` + `appointmentId`)
   - Actualización de `status` a `"completed"`
   - Actualización de `updatedAt` con timestamp actual

#### Interacciones AWS

- **SQS**: Consumo de mensajes de SQS_CONFIRMATION
- **DynamoDB**: `UpdateItem` para actualizar estado y timestamp

---

### 4. GetAppointmentsByInsuredUseCase

#### Propósito

Recuperar todas las citas médicas asociadas a un asegurado específico desde DynamoDB utilizando la clave de partición para una consulta eficiente.

#### Entradas

- **`insuredId`** (string, requerido): Identificador único del asegurado

#### Salidas

- **Array de `Appointment`**: Arreglo de entidades con todas las citas del asegurado (vacío si no hay resultados)

#### Flujo Interno

1. Recepción del `insuredId`
2. Invocación de `AppointmentDynamoRepository.findByInsuredId()`
3. Ejecución de `Query` en DynamoDB utilizando `insuredId` como clave de partición
4. Mapeo de resultados a entidades de dominio
5. Retorno del arreglo de citas

#### Interacciones AWS

- **DynamoDB**: `Query` utilizando `insuredId` como clave de partición

---

## 📡 Documentación de Uso (API)

### Endpoints Disponibles

#### POST `/appointments`

Registra una nueva cita médica para un asegurado. La cita se almacena inicialmente en DynamoDB con estado `pending` y se inicia el procesamiento asíncrono según el país correspondiente.

**Request Body:**

```json
{
  "insuredId": "00001",
  "scheduleId": 100,
  "countryISO": "PE"
}
```

**Response (201 Created):**

```json
{
  "message": "Cita registrada y en proceso de agendamiento",
  "appointmentId": "3c6c9b1e-6f7e-4c7f-b3f4-123456789abc",
  "status": "pending"
}
```

**Validaciones:**

- `insuredId`: Cadena de texto no vacía (requerido)
- `scheduleId`: Número entero positivo (requerido)
- `countryISO`: Debe ser exactamente "PE" o "CL" (requerido)

**Errores Posibles:**

- `400 Bad Request`: Error de validación en los datos enviados
- `500 Internal Server Error`: Error interno del servidor

---

#### GET `/appointments/{insuredId}`

Obtiene todas las citas médicas asociadas a un asegurado específico. La información se consulta desde DynamoDB y refleja el estado actual (`pending` o `completed`) de cada cita.

**Path Parameters:**

- `insuredId` (string, requerido): Identificador del asegurado

**Response (200 OK):**

```json
{
  "insuredId": "00001",
  "appointments": [
    {
      "appointmentId": "3c6c9b1e-6f7e-4c7f-b3f4-123456789abc",
      "scheduleId": 100,
      "countryISO": "PE",
      "status": "completed",
      "createdAt": "2025-11-24T10:00:00.000Z",
      "updatedAt": "2025-11-24T10:02:30.000Z"
    }
  ]
}
```

**Notas:**

- Si el `insuredId` no tiene citas asociadas, se retorna un arreglo vacío
- El estado puede ser `"pending"` (en procesamiento) o `"completed"` (procesada exitosamente)

**Errores Posibles:**

- `400 Bad Request`: El parámetro `insuredId` es requerido
- `500 Internal Server Error`: Error interno del servidor

---

## 🧪 Pruebas E2E

### Flujo Completo de Prueba End-to-End

#### Prerrequisitos

- Herramienta para realizar peticiones HTTP (curl, Postman, Insomnia)
- Acceso a internet para conectarse al servicio desplegado

#### Escenario 1: Crear y Consultar Cita

1. **Crear una cita:**

```bash
curl -X POST https://citamedica.erichbalois.com/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "insuredId": "00001",
    "scheduleId": 100,
    "countryISO": "PE"
  }'
```

**Resultado esperado:** Respuesta 201 con `appointmentId` y `status: "pending"`

2. **Consultar citas inmediatamente:**

```bash
curl -X GET https://citamedica.erichbalois.com/appointments/00001
```

**Resultado esperado:** La cita aparece con `status: "pending"`

3. **Esperar procesamiento asíncrono** (generalmente menos de 30 segundos)

4. **Consultar citas nuevamente:**

```bash
curl -X GET https://citamedica.erichbalois.com/appointments/00001
```

**Resultado esperado:** La cita aparece con `status: "completed"`

#### Escenario 2: Validación de Errores

1. **Intentar crear cita con `countryISO` inválido:**

```bash
curl -X POST https://citamedica.erichbalois.com/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "insuredId": "00001",
    "scheduleId": 100,
    "countryISO": "MX"
  }'
```

**Resultado esperado:** Error 400 con mensaje de validación

2. **Intentar crear cita sin campos requeridos:**

```bash
curl -X POST https://citamedica.erichbalois.com/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "insuredId": "00001"
  }'
```

**Resultado esperado:** Error 400 indicando campos faltantes

#### Escenario 3: Múltiples Citas por Asegurado

1. Crear varias citas para el mismo `insuredId` con diferentes `scheduleId`
2. Consultar todas las citas del asegurado
3. Verificar que todas aparecen en la respuesta con sus respectivos estados

## 📚 Documentación OpenAPI

La API está documentada utilizando el estándar **OpenAPI 3.0.3**, proporcionando una especificación completa y legible por máquina de todos los endpoints, parámetros, esquemas de datos y respuestas.

### Ubicación del Archivo

```
/docs/openapi.yaml
```

### Visualización Interactiva

Para visualizar y explorar la documentación de forma interactiva:

1. Accede a [Swagger Editor](https://editor.swagger.io/)
2. Copia el contenido completo del archivo `docs/openapi.yaml`
3. Pégalo en el editor
4. La documentación se renderizará automáticamente con una interfaz interactiva

### Esquemas Documentados

La especificación OpenAPI incluye definiciones completas de:

- **CreateAppointmentRequest**: Esquema de validación para la creación de citas
- **CreateAppointmentResponse**: Estructura de respuesta al crear una cita
- **AppointmentItem**: Modelo de datos de una cita individual
- **AppointmentsByInsuredResponse**: Estructura de respuesta al consultar citas por asegurado
- **ErrorResponse**: Formato estándar de mensajes de error

Todos los esquemas incluyen descripciones detalladas, tipos de datos, validaciones, ejemplos y códigos de estado HTTP correspondientes.

### Beneficios

- **Interoperabilidad**: Facilita la integración mediante generación automática de clientes
- **Validación**: Los esquemas pueden utilizarse para validar requests y responses
- **Testing**: Permite generar casos de prueba automáticos
- **Colaboración**: Fuente única de verdad para desarrolladores
- **Mantenibilidad**: Documentación centralizada en formato estándar y versionado

## ⚙️ Variables de Entorno

### Variables Requeridas

#### Bases de Datos

- **`DATABASE_URL_PE`**: Cadena de conexión a la base de datos MySQL de Perú
  - Formato: `mysql://user:password@host:3306/database_pe`

- **`DATABASE_URL_CL`**: Cadena de conexión a la base de datos MySQL de Chile
  - Formato: `mysql://user:password@host:3306/database_cl`

#### Configuración VPC

- **`LAMBDA_SECURITY_GROUP_ID`**: ID del Security Group para las lambdas en VPC
  - Formato: `sg-xxxxxxxxxxxxxxxxx`

- **`SUBNET_ID_1`**: ID de la primera subnet (debe estar en una Availability Zone)
  - Formato: `subnet-xxxxxxxxxxxxxxxxx`

- **`SUBNET_ID_2`**: ID de la segunda subnet (debe estar en otra Availability Zone diferente)
  - Formato: `subnet-yyyyyyyyyyyyyyyyy`

#### Variables Configuradas por Serverless Framework

Las siguientes variables son configuradas automáticamente por el Serverless Framework durante el despliegue:

- **`APPOINTMENTS_TABLE`**: Nombre de la tabla DynamoDB
- **`APPOINTMENT_REQUESTED_TOPIC_ARN`**: ARN del SNS Topic para eventos de citas solicitadas
- **`APPOINTMENT_COMPLETED_EVENT_BUS_NAME`**: Nombre del EventBridge para eventos de citas completadas

### Configuración Local

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Edita el archivo `.env` con tus valores:

```env
DATABASE_URL_PE=mysql://user:password@host:3306/database_pe
DATABASE_URL_CL=mysql://user:password@host:3306/database_cl
LAMBDA_SECURITY_GROUP_ID=sg-xxxxxxxxxxxxxxxxx
SUBNET_ID_1=subnet-xxxxxxxxxxxxxxxxx
SUBNET_ID_2=subnet-yyyyyyyyyyyyyyyyy
```

## 🚀 Instalación y Despliegue

### Requisitos Previos

- Node.js >= 20.x
- npm >= 9.x
- AWS CLI configurado con credenciales válidas
- Cuenta de AWS con permisos para crear recursos
- Acceso a bases de datos RDS MySQL (PE y CL)
- VPC configurada con Security Groups y Subnets

### Instalación

1. **Clonar el repositorio:**

```bash
git clone <repository-url>
cd medical-appointment-backend
```

2. **Instalar dependencias:**

```bash
npm install
```

3. **Generar clientes de Prisma:**

```bash
npx prisma generate --schema=src/infrastructure/rds/prisma/schema-pe.prisma
npx prisma generate --schema=src/infrastructure/rds/prisma/schema-cl.prisma
```

4. **Configurar variables de entorno:**

```bash
cp .env.example .env
# Editar .env con tus valores
```

### Despliegue

#### Desarrollo

```bash
npm run deploy:dev
```

#### Producción

```bash
npm run deploy:prod
```

#### Desarrollo Local

```bash
npm run dev
```

Esto iniciará Serverless Offline para desarrollo local.

### Scripts Disponibles

- `npm run dev`: Inicia Serverless Offline para desarrollo local
- `npm run deploy:dev`: Despliega a ambiente de desarrollo
- `npm run deploy:prod`: Despliega a ambiente de producción
- `npm test`: Ejecuta los tests con Jest

## 🌐 URLs del Servicio

### URL Base

**Servicio Desplegado:** `https://citamedica.erichbalois.com`

El servicio está completamente operativo y desplegado en producción, con todos los endpoints disponibles públicamente sin requerir autenticación.

### Endpoints Completos

- **POST** `https://citamedica.erichbalois.com/appointments`
- **GET** `https://citamedica.erichbalois.com/appointments/{insuredId}`

### Ejemplos de Uso

#### Crear Cita

```bash
curl -X POST https://citamedica.erichbalois.com/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "insuredId": "00001",
    "scheduleId": 100,
    "countryISO": "PE"
  }'
```

#### Consultar Citas

```bash
curl -X GET https://citamedica.erichbalois.com/appointments/00001
```

> **Nota:** Los endpoints son públicamente accesibles y no requieren autenticación para su uso.

## 🔗 Repositorio Público

**URL del Repositorio Público:**
<!-- TODO: Agregar URL del repositorio público aquí -->

El código fuente completo del proyecto está disponible en el repositorio indicado, incluyendo:

- Implementación completa del sistema
- Configuración de infraestructura (Serverless Framework)
- Documentación técnica
- Scripts de despliegue
- Tests unitarios
- Especificación OpenAPI

## 🧪 Pruebas Unitarias

### Ejecutar Tests

```bash
npm test
```

### Estructura de Tests

Los tests están organizados siguiendo la estructura del proyecto:

```
tests/
├── unit/
│   └── handlers/
│       └── appointment/
│           └── handler.spec.ts
```

### Cobertura

Los tests unitarios cubren:

- Validación de datos de entrada
- Lógica de casos de uso
- Manejo de errores
- Transformación de datos

### Ejemplo de Test

```typescript
describe('CreateAppointmentHandler', () => {
  it('should create an appointment with valid data', async () => {
    // Test implementation
  });
});
```

## 💼 Cómo Explicar el Reto en Entrevista

### Resumen Ejecutivo (30 segundos)

"Implementé un sistema backend serverless para agendamiento de citas médicas multi-país usando AWS. La arquitectura utiliza Lambda, API Gateway, DynamoDB para consultas rápidas, RDS MySQL para persistencia por país, y un sistema de mensajería asíncrona con SNS, SQS y EventBridge para procesar las citas de forma distribuida."

### Puntos Clave a Destacar

1. **Arquitectura Distribuida**: 
   - "Diseñé una arquitectura que separa el procesamiento por país (Perú y Chile) utilizando colas SQS independientes, permitiendo escalar y mantener cada país de forma independiente."

2. **Clean Architecture y SOLID**:
   - "Apliqué Clean Architecture con separación de capas (dominio, aplicación, infraestructura, interfaces) y principios SOLID, especialmente Dependency Inversion para desacoplar los casos de uso de implementaciones concretas."

3. **Procesamiento Asíncrono**:
   - "Implementé un flujo asíncrono donde las citas se crean inicialmente en DynamoDB con estado 'pending', se procesan en segundo plano según el país, y finalmente se actualiza el estado a 'completed' mediante EventBridge."

4. **Optimización de Bases de Datos**:
   - "Utilicé DynamoDB para consultas rápidas por asegurado (usando insuredId como clave de partición) y RDS MySQL para persistencia definitiva por país, optimizando para lectura y escritura respectivamente."

5. **Resiliencia y Manejo de Errores**:
   - "Implementé Dead Letter Queues (DLQ) para manejo de errores y garantizar que los mensajes fallidos puedan ser reprocesados."

### Preguntas Técnicas Comunes

**"¿Por qué usaste DynamoDB y RDS MySQL?"**
- "DynamoDB para consultas rápidas por asegurado con baja latencia. RDS MySQL para persistencia definitiva y cumplir con requisitos de almacenamiento por país. Esta separación optimiza el rendimiento."

**"¿Cómo garantizas la consistencia entre DynamoDB y RDS?"**
- "Mediante un flujo de eventos: primero se guarda en DynamoDB, luego se procesa asíncronamente en RDS, y finalmente se actualiza el estado en DynamoDB cuando se confirma la persistencia en RDS."

**"¿Qué harías diferente si tuvieras más tiempo?"**
- "Implementaría idempotencia en los endpoints, agregaría autenticación y autorización, implementaría métricas y monitoreo con CloudWatch, y agregaría más tests de integración."

## 📦 Entrega Final

### Información del Servicio Desplegado

**URL del Servicio:** `https://citamedica.erichbalois.com`

El servicio está completamente operativo y desplegado en producción, con todos los endpoints disponibles públicamente sin requerir autenticación.

### Documentación OpenAPI

La especificación completa de la API está disponible en formato OpenAPI 3.0.3:

**Ubicación:** `docs/openapi.yaml`

Esta especificación puede ser utilizada para:
- Visualización interactiva en [Swagger Editor](https://editor.swagger.io/)
- Generación automática de clientes SDK
- Validación de requests y responses
- Documentación técnica de referencia

### Instrucciones para Probar el API

#### Prerrequisitos

- Herramienta para realizar peticiones HTTP (curl, Postman, Insomnia, o similar)
- Acceso a internet para conectarse al servicio desplegado

#### Probar el Endpoint POST `/appointments`

```bash
curl -X POST https://citamedica.erichbalois.com/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "insuredId": "00001",
    "scheduleId": 100,
    "countryISO": "PE"
  }'
```

**Respuesta esperada (201 Created):**

```json
{
  "message": "Cita registrada y en proceso de agendamiento",
  "appointmentId": "3c6c9b1e-6f7e-4c7f-b3f4-123456789abc",
  "status": "pending"
}
```

#### Probar el Endpoint GET `/appointments/{insuredId}`

```bash
curl -X GET https://citamedica.erichbalois.com/appointments/00001
```

**Respuesta esperada (200 OK):**

```json
{
  "insuredId": "00001",
  "appointments": [
    {
      "appointmentId": "3c6c9b1e-6f7e-4c7f-b3f4-123456789abc",
      "scheduleId": 100,
      "countryISO": "PE",
      "status": "completed",
      "createdAt": "2025-11-24T10:00:00.000Z",
      "updatedAt": "2025-11-24T10:02:30.000Z"
    }
  ]
}
```

#### Flujo Completo de Prueba

1. **Crear una cita:** Ejecute el POST `/appointments` con datos válidos
2. **Verificar estado inicial:** Ejecute el GET `/appointments/{insuredId}` inmediatamente después; la cita debería aparecer con estado `"pending"`
3. **Esperar procesamiento:** El sistema procesará la cita de forma asíncrona (generalmente en menos de 30 segundos)
4. **Verificar estado final:** Ejecute nuevamente el GET `/appointments/{insuredId}`; la cita debería aparecer con estado `"completed"`

### Infraestructura AWS Desplegada

**Nota importante:** Toda la infraestructura del sistema está completamente desplegada y operativa en AWS, incluyendo los siguientes servicios:

- **API Gateway**: Punto de entrada HTTP para las peticiones del API
- **AWS Lambda**: Funciones serverless que procesan las peticiones y eventos
  - `appointment`: Handler principal para endpoints HTTP y actualización de estado
  - `appointmentPe`: Procesamiento asíncrono para citas de Perú
  - `appointmentCl`: Procesamiento asíncrono para citas de Chile
- **DynamoDB**: Base de datos NoSQL para almacenamiento principal y consultas rápidas
- **Amazon SNS**: Servicio de notificaciones para distribución de eventos por país
- **Amazon SQS**: Colas de mensajes para procesamiento asíncrono (SQS_PE, SQS_CL, SQS_CONFIRMATION)
- **Amazon EventBridge**: Servicio de eventos para orquestación del flujo de confirmación
- **Amazon RDS MySQL**: Bases de datos relacionales para persistencia por país (PE y CL)
- **Amazon VPC**: Red privada virtual para acceso seguro a las bases de datos RDS

La arquitectura implementa un patrón de procesamiento asíncrono distribuido que garantiza alta disponibilidad, escalabilidad automática y resiliencia mediante el uso de Dead Letter Queues (DLQ) para el manejo de errores.

## 🔮 Mejoras Futuras

### Seguridad y Autenticación

- Implementar autenticación mediante JWT o AWS Cognito
- Agregar autorización basada en roles (RBAC)
- Implementar rate limiting en API Gateway
- Agregar validación de tokens y firma de requests

### Observabilidad y Monitoreo

- Implementar métricas personalizadas en CloudWatch
- Agregar dashboards para monitoreo de flujos
- Implementar alertas para errores y latencias altas
- Agregar distributed tracing con AWS X-Ray
- Implementar logging estructurado con niveles apropiados

### Resiliencia y Confiabilidad

- Implementar retry policies con exponential backoff
- Agregar circuit breakers para servicios externos
- Implementar idempotencia en endpoints críticos
- Agregar health checks y readiness probes
- Implementar versionado de API

### Performance y Optimización

- Implementar caching con ElastiCache para consultas frecuentes
- Optimizar consultas DynamoDB con índices secundarios si es necesario
- Implementar paginación en endpoints de listado
- Agregar compresión de respuestas HTTP
- Optimizar cold starts de Lambda con provisioned concurrency

### Testing

- Agregar tests de integración end-to-end
- Implementar tests de carga con Artillery o k6
- Agregar tests de contratos (Contract Testing)
- Implementar tests de mutación (Mutation Testing)
- Agregar tests de seguridad (OWASP Top 10)

### Documentación

- Agregar diagramas de secuencia detallados
- Implementar documentación de decisiones arquitectónicas (ADRs)
- Agregar guías de troubleshooting
- Crear documentación de runbooks para operaciones

### Funcionalidades Adicionales

- Implementar cancelación de citas
- Agregar notificaciones por email/SMS cuando se completa una cita
- Implementar búsqueda avanzada de citas con filtros
- Agregar soporte para más países
- Implementar sistema de recordatorios de citas

---

## 📝 Licencia

ISC

## 👥 Contribución

Este es un proyecto de reto técnico. Para contribuciones, por favor abre un issue o pull request.
