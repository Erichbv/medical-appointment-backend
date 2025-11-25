# Medical Appointment Backend

Backend para un sistema de agendamiento de citas médicas, diseñado con una arquitectura distribuida que integra API Gateway, SNS, SQS, EventBridge y múltiples bases de datos optimizadas para garantizar alto rendimiento, escalabilidad y resiliencia.

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura](#-arquitectura-del-sistema)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Despliegue](#-despliegue)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Scripts Disponibles](#-scripts-disponibles)
- [Testing](#-testing)

## ✨ Características

- **Arquitectura Serverless**: Implementado con AWS Lambda y API Gateway
- **Separación por País**: Procesamiento independiente para Perú (PE) y Chile (CL)
- **Múltiples Bases de Datos**: DynamoDB para consultas rápidas y RDS MySQL para persistencia por país
- **Mensajería Asíncrona**: SNS, SQS y EventBridge para comunicación entre servicios
- **Escalabilidad**: Diseño que se adapta automáticamente a la carga
- **Resiliencia**: Dead Letter Queues (DLQ) para manejo de errores

## 🏗️ Arquitectura del Sistema

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

### Flujo de la Arquitectura

1. **Entrada de Peticiones**: El cliente envía peticiones HTTP a través del API Gateway
2. **Procesamiento Inicial**: La Lambda `appointment` recibe la petición, guarda la información en DynamoDB y publica un evento al SNS Topic
3. **Distribución por País**: El SNS Topic distribuye el evento a las colas SQS correspondientes según el país (SQS_PE para Perú, SQS_CL para Chile)
4. **Procesamiento por País**: Las Lambdas `appointmentPe` y `appointmentCl` consumen mensajes de sus respectivas colas y persisten los datos en sus bases de datos RDS correspondientes
5. **Eventos de Confirmación**: Las Lambdas de país publican eventos a EventBridge
6. **Actualización de Estado**: EventBridge envía confirmaciones a SQS_CONFIRMATION, que es consumida por la Lambda `appointment` para actualizar el estado en DynamoDB

## 🛠️ Tecnologías

- **Runtime**: Node.js 20.x
- **Framework**: Serverless Framework 4.x
- **Lenguaje**: TypeScript 5.x
- **Bases de Datos**:
  - DynamoDB (almacenamiento principal)
  - RDS MySQL (persistencia por país con Prisma ORM)
- **Servicios AWS**:
  - Lambda Functions
  - API Gateway
  - SNS (Simple Notification Service)
  - SQS (Simple Queue Service)
  - EventBridge
  - VPC (para acceso a RDS)
- **Herramientas**:
  - Prisma (ORM)
  - Jest (Testing)
  - Joi (Validación)

## 📦 Requisitos Previos

- Node.js >= 20.x
- npm >= 9.x
- AWS CLI configurado con credenciales válidas
- Cuenta de AWS con permisos para crear recursos
- Acceso a bases de datos RDS MySQL (PE y CL)
- VPC configurada con Security Groups y Subnets

## 🚀 Instalación

1. Clona el repositorio:
```bash
git clone <repository-url>
cd medical-appointment-backend
```

2. Instala las dependencias:
```bash
npm install
```

3. Genera los clientes de Prisma:
```bash
npx prisma generate --schema=src/infrastructure/rds/prisma/schema-pe.prisma
npx prisma generate --schema=src/infrastructure/rds/prisma/schema-cl.prisma
```

## ⚙️ Configuración

1. Copia el archivo de ejemplo de variables de entorno:
```bash
cp .env.example .env
```

2. Edita el archivo `.env` y configura las siguientes variables:

```env
# Database Connection Strings
DATABASE_URL_PE=mysql://user:password@host:3306/database_pe
DATABASE_URL_CL=mysql://user:password@host:3306/database_cl

# VPC Configuration (requerido para lambdas appointmentPe y appointmentCl)
LAMBDA_SECURITY_GROUP_ID=sg-xxxxxxxxxxxxxxxxx
SUBNET_ID_1=subnet-xxxxxxxxxxxxxxxxx
SUBNET_ID_2=subnet-yyyyyyyyyyyyyyyyy
```

### Variables de Entorno Requeridas

- `DATABASE_URL_PE`: Cadena de conexión a la base de datos MySQL de Perú
- `DATABASE_URL_CL`: Cadena de conexión a la base de datos MySQL de Chile
- `LAMBDA_SECURITY_GROUP_ID`: ID del Security Group para las lambdas en VPC
- `SUBNET_ID_1`: ID de la primera subnet (debe estar en una Availability Zone)
- `SUBNET_ID_2`: ID de la segunda subnet (debe estar en otra Availability Zone diferente)

## 🚢 Despliegue

### Desarrollo
```bash
npm run deploy:dev
```

### Producción
```bash
npm run deploy:prod
```

### Desarrollo Local
```bash
npm run dev
```

Esto iniciará Serverless Offline para desarrollo local.

## 📁 Estructura del Proyecto

```
medical-appointment-backend/
├── src/
│   ├── application/          # Casos de uso (lógica de negocio)
│   │   └── usecases/
│   ├── domain/               # Entidades y repositorios del dominio
│   │   ├── entities/
│   │   ├── repositories/
│   │   └── value-objects/
│   ├── infrastructure/       # Implementaciones de infraestructura
│   │   ├── dynamodb/        # Repositorio DynamoDB
│   │   ├── messaging/        # SNS, SQS, EventBridge
│   │   └── rds/             # Repositorio RDS con Prisma
│   └── interfaces/           # Puntos de entrada (Lambdas, HTTP)
│       ├── http/            # DTOs y validadores
│       └── lambdas/         # Handlers de Lambda
├── docs/                     # Documentación
├── tests/                    # Tests
├── serverless.ts            # Configuración de Serverless Framework
├── package.json
└── tsconfig.json
```

## 📜 Scripts Disponibles

- `npm run dev`: Inicia Serverless Offline para desarrollo local
- `npm run deploy:dev`: Despliega a ambiente de desarrollo
- `npm run deploy:prod`: Despliega a ambiente de producción
- `npm test`: Ejecuta los tests con Jest

## 🧪 Testing

Ejecuta los tests con:
```bash
npm test
```

## 📝 Licencia

ISC

## 👥 Contribución

Este es un proyecto de reto técnico. Para contribuciones, por favor abre un issue o pull request.