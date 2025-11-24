# medical-appointment-backend
Backend para un sistema de agendamiento de citas, diseñado con una arquitectura distribuida que integra API Gateway, SNS, SQS y múltiples bases de datos optimizadas para garantizar alto rendimiento, escalabilidad y resiliencia.

## Arquitectura del Sistema

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