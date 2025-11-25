import { SNSClient, ListSubscriptionsByTopicCommand, GetSubscriptionAttributesCommand, PublishCommand } from "@aws-sdk/client-sns";
import { SQSClient, GetQueueAttributesCommand, GetQueueUrlCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { v4 as uuidv4 } from "uuid";

const snsClient = new SNSClient({ region: "us-east-1" });
const sqsClient = new SQSClient({ region: "us-east-1" });

// Configuración - ajusta estos valores según tu entorno
const TOPIC_ARN = process.env.SNS_TOPIC_ARN || "arn:aws:sns:us-east-1:845958740574:appointment-topic";
const QUEUE_PE_NAME = "appointments-pe-queue";
const QUEUE_CL_NAME = "appointments-cl-queue";
const ACCOUNT_ID = "845958740574";

interface SubscriptionInfo {
  subscriptionArn: string;
  endpoint: string;
  protocol: string;
  owner: string;
  topicArn: string;
  confirmationWasAuthenticated: boolean;
  filterPolicy?: string | undefined;
  filterPolicyScope?: string | undefined;
  pendingConfirmation?: boolean | undefined;
}

async function getQueueUrl(queueName: string): Promise<string | null> {
  try {
    const result = await sqsClient.send(
      new GetQueueUrlCommand({
        QueueName: queueName,
      })
    );
    return result.QueueUrl || null;
  } catch (error) {
    console.error(`❌ Error obteniendo URL de cola ${queueName}:`, error);
    return null;
  }
}

async function checkQueuePolicy(queueUrl: string, queueName: string, topicArn: string): Promise<void> {
  console.log(`\n📋 [DIAGNÓSTICO] Verificando política de ${queueName}...`);
  
  try {
    const result = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["Policy", "QueueArn"],
      })
    );

    const policy = result.Attributes?.Policy;
    const queueArn = result.Attributes?.QueueArn;

    if (!policy) {
      console.log(`⚠️  [DIAGNÓSTICO] ${queueName}: No tiene política configurada`);
      return;
    }

    const policyDoc = JSON.parse(policy);
    console.log(`✅ [DIAGNÓSTICO] ${queueName} tiene política configurada`);
    console.log(`   Queue ARN: ${queueArn}`);

    // Verificar si la política permite a SNS enviar mensajes
    const statements = policyDoc.Statement || [];
    const snsStatement = statements.find((s: any) => 
      s.Principal?.Service === "sns.amazonaws.com" || 
      s.Principal?.AWS === `arn:aws:iam::${ACCOUNT_ID}:root`
    );

    if (snsStatement) {
      console.log(`✅ [DIAGNÓSTICO] ${queueName}: Política permite a SNS enviar mensajes`);
      if (snsStatement.Condition?.ArnEquals?.["aws:SourceArn"]) {
        const sourceArn = snsStatement.Condition.ArnEquals["aws:SourceArn"];
        if (sourceArn === topicArn) {
          console.log(`✅ [DIAGNÓSTICO] ${queueName}: SourceArn coincide con el topic`);
        } else {
          console.log(`⚠️  [DIAGNÓSTICO] ${queueName}: SourceArn no coincide`);
          console.log(`   Esperado: ${topicArn}`);
          console.log(`   Actual: ${sourceArn}`);
        }
      }
    } else {
      console.log(`❌ [DIAGNÓSTICO] ${queueName}: Política NO permite a SNS enviar mensajes`);
    }
  } catch (error) {
    console.error(`❌ [DIAGNÓSTICO] Error verificando política de ${queueName}:`, error);
  }
}

async function checkSubscriptions(topicArn: string): Promise<SubscriptionInfo[]> {
  console.log(`\n📋 [DIAGNÓSTICO] Verificando suscripciones del topic...`);
  console.log(`   Topic ARN: ${topicArn}`);

  try {
    const result = await snsClient.send(
      new ListSubscriptionsByTopicCommand({
        TopicArn: topicArn,
      })
    );

    const subscriptions = result.Subscriptions || [];
    console.log(`✅ [DIAGNÓSTICO] Encontradas ${subscriptions.length} suscripciones`);

    const subscriptionInfos: SubscriptionInfo[] = [];

    for (const sub of subscriptions) {
      if (!sub.SubscriptionArn) continue;

      console.log(`\n📌 [DIAGNÓSTICO] Suscripción: ${sub.SubscriptionArn}`);
      console.log(`   Endpoint: ${sub.Endpoint}`);
      console.log(`   Protocol: ${sub.Protocol}`);

      try {
        const attrsResult = await snsClient.send(
          new GetSubscriptionAttributesCommand({
            SubscriptionArn: sub.SubscriptionArn,
          })
        );

        const attrs = attrsResult.Attributes || {};
        const filterPolicy = attrs.FilterPolicy;
        const filterPolicyScope = attrs.FilterPolicyScope;
        const pendingConfirmation = attrs.PendingConfirmation === "true";

        console.log(`   Estado: ${attrs.SubscriptionArn?.includes("PendingConfirmation") ? "⏳ Pending Confirmation" : "✅ Confirmed"}`);
        
        if (filterPolicy) {
          console.log(`   FilterPolicy: ${filterPolicy}`);
          console.log(`   FilterPolicyScope: ${filterPolicyScope || "Message attributes (default)"}`);
        } else {
          console.log(`   ⚠️  FilterPolicy: NO CONFIGURADO`);
        }

        subscriptionInfos.push({
          subscriptionArn: sub.SubscriptionArn,
          endpoint: sub.Endpoint || "",
          protocol: sub.Protocol || "",
          owner: sub.Owner || "",
          topicArn: sub.TopicArn || "",
          confirmationWasAuthenticated: attrs.ConfirmationWasAuthenticated === "true",
          filterPolicy,
          filterPolicyScope,
          pendingConfirmation,
        });
      } catch (error) {
        console.error(`   ❌ Error obteniendo atributos:`, error);
      }
    }

    return subscriptionInfos;
  } catch (error) {
    console.error(`❌ [DIAGNÓSTICO] Error listando suscripciones:`, error);
    return [];
  }
}

async function publishTestMessage(countryISO: "PE" | "CL"): Promise<string | null> {
  const testMessage = {
    appointmentId: uuidv4(),
    insuredId: "TEST-001",
    scheduleId: 999,
    countryISO,
  };

  const message = JSON.stringify(testMessage);
  const messageAttributes = {
    countryISO: {
      DataType: "String",
      StringValue: countryISO,
    },
  };

  console.log(`\n📤 [DIAGNÓSTICO] Publicando mensaje de prueba para ${countryISO}...`);
  console.log(`   Message: ${message}`);
  console.log(`   MessageAttributes:`, JSON.stringify(messageAttributes, null, 2));

  try {
    const result = await snsClient.send(
      new PublishCommand({
        TopicArn: TOPIC_ARN,
        Message: message,
        MessageAttributes: messageAttributes,
      })
    );

    console.log(`✅ [DIAGNÓSTICO] Mensaje publicado exitosamente`);
    console.log(`   MessageId: ${result.MessageId}`);
    return result.MessageId || null;
  } catch (error) {
    console.error(`❌ [DIAGNÓSTICO] Error publicando mensaje:`, error);
    return null;
  }
}

async function checkQueueMessages(queueUrl: string, queueName: string, waitSeconds: number = 5): Promise<void> {
  console.log(`\n🔍 [DIAGNÓSTICO] Verificando mensajes en ${queueName}...`);
  console.log(`   Esperando ${waitSeconds} segundos...`);

  await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));

  try {
    // Obtener número de mensajes
    const attrsResult = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: [
          "ApproximateNumberOfMessages",
          "ApproximateNumberOfMessagesNotVisible",
          "ApproximateNumberOfMessagesDelayed",
        ],
      })
    );

    const visible = attrsResult.Attributes?.ApproximateNumberOfMessages || "0";
    const notVisible = attrsResult.Attributes?.ApproximateNumberOfMessagesNotVisible || "0";
    const delayed = attrsResult.Attributes?.ApproximateNumberOfMessagesDelayed || "0";

    console.log(`📊 [DIAGNÓSTICO] Estado de ${queueName}:`);
    console.log(`   Mensajes visibles: ${visible}`);
    console.log(`   Mensajes en procesamiento: ${notVisible}`);
    console.log(`   Mensajes retrasados: ${delayed}`);

    if (visible === "0" && notVisible === "0") {
      console.log(`⚠️  [DIAGNÓSTICO] No hay mensajes en ${queueName}`);
      return;
    }

    // Intentar recibir un mensaje
    const receiveResult = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 2,
        MessageAttributeNames: ["All"],
      })
    );

    if (receiveResult.Messages && receiveResult.Messages.length > 0) {
      const message = receiveResult.Messages[0];
      if (message) {
        console.log(`✅ [DIAGNÓSTICO] Mensaje encontrado en ${queueName}:`);
        console.log(`   MessageId: ${message.MessageId}`);
        
        if (message.Body) {
          try {
            const body = JSON.parse(message.Body);
            console.log(`   Body (parsed):`, JSON.stringify(body, null, 2));
            
            if (body.Message) {
              const snsMessage = JSON.parse(body.Message);
              console.log(`   SNS Message:`, JSON.stringify(snsMessage, null, 2));
            }
          } catch (e) {
            console.log(`   Body (raw): ${message.Body.substring(0, 200)}...`);
          }
        }

        if (message.MessageAttributes) {
          console.log(`   MessageAttributes:`, JSON.stringify(message.MessageAttributes, null, 2));
        }
      }
    } else {
      console.log(`⚠️  [DIAGNÓSTICO] No se pudieron recibir mensajes (puede que ya fueron procesados)`);
    }
  } catch (error) {
    console.error(`❌ [DIAGNÓSTICO] Error verificando mensajes:`, error);
  }
}

async function main(): Promise<void> {
  console.log("🔍 [DIAGNÓSTICO] Iniciando diagnóstico de SNS -> SQS");
  console.log("=".repeat(80));

  try {
    // 1. Verificar suscripciones
    const subscriptions = await checkSubscriptions(TOPIC_ARN);

    // 2. Verificar políticas de las colas
    const queuePeUrl = await getQueueUrl(QUEUE_PE_NAME);
    const queueClUrl = await getQueueUrl(QUEUE_CL_NAME);

    if (queuePeUrl) {
      await checkQueuePolicy(queuePeUrl, QUEUE_PE_NAME, TOPIC_ARN);
    } else {
      console.log(`❌ [DIAGNÓSTICO] No se pudo obtener URL de ${QUEUE_PE_NAME}`);
    }

    if (queueClUrl) {
      await checkQueuePolicy(queueClUrl, QUEUE_CL_NAME, TOPIC_ARN);
    } else {
      console.log(`❌ [DIAGNÓSTICO] No se pudo obtener URL de ${QUEUE_CL_NAME}`);
    }

    // 3. Verificar FilterPolicies
    console.log(`\n📋 [DIAGNÓSTICO] Resumen de FilterPolicies:`);
    for (const sub of subscriptions) {
      if (sub.protocol === "sqs") {
        const queueName = sub.endpoint.includes("pe-queue") ? "PE" : 
                         sub.endpoint.includes("cl-queue") ? "CL" : "Unknown";
        console.log(`\n   ${queueName} Queue:`);
        if (sub.filterPolicy) {
          console.log(`   ✅ FilterPolicy configurado: ${sub.filterPolicy}`);
          console.log(`   ✅ FilterPolicyScope: ${sub.filterPolicyScope || "Message attributes"}`);
        } else {
          console.log(`   ❌ FilterPolicy NO configurado`);
        }
        if (sub.pendingConfirmation) {
          console.log(`   ⚠️  Suscripción pendiente de confirmación`);
        } else {
          console.log(`   ✅ Suscripción confirmada`);
        }
      }
    }

    // 4. Publicar mensaje de prueba para PE
    console.log(`\n${"=".repeat(80)}`);
    console.log("PRUEBA 1: Publicando mensaje para PE");
    console.log("=".repeat(80));
    await publishTestMessage("PE");
    if (queuePeUrl) {
      await checkQueueMessages(queuePeUrl, QUEUE_PE_NAME, 5);
    }

    // 5. Publicar mensaje de prueba para CL
    console.log(`\n${"=".repeat(80)}`);
    console.log("PRUEBA 2: Publicando mensaje para CL");
    console.log("=".repeat(80));
    await publishTestMessage("CL");
    if (queueClUrl) {
      await checkQueueMessages(queueClUrl, QUEUE_CL_NAME, 5);
    }

    // 6. Resumen final
    console.log(`\n${"=".repeat(80)}`);
    console.log("📊 RESUMEN DEL DIAGNÓSTICO");
    console.log("=".repeat(80));
    
    const peSub = subscriptions.find(s => s.endpoint.includes("pe-queue"));
    const clSub = subscriptions.find(s => s.endpoint.includes("cl-queue"));

    console.log(`\n✅ Suscripción PE:`);
    console.log(`   - Existe: ${peSub ? "Sí" : "No"}`);
    if (peSub) {
      console.log(`   - Confirmada: ${!peSub.pendingConfirmation ? "Sí" : "No"}`);
      console.log(`   - FilterPolicy: ${peSub.filterPolicy || "NO CONFIGURADO"}`);
    }

    console.log(`\n✅ Suscripción CL:`);
    console.log(`   - Existe: ${clSub ? "Sí" : "No"}`);
    if (clSub) {
      console.log(`   - Confirmada: ${!clSub.pendingConfirmation ? "Sí" : "No"}`);
      console.log(`   - FilterPolicy: ${clSub.filterPolicy || "NO CONFIGURADO"}`);
    }

    console.log(`\n💡 Si los mensajes no llegan, verifica:`);
    console.log(`   1. Que las suscripciones estén confirmadas`);
    console.log(`   2. Que los FilterPolicies estén correctamente configurados`);
    console.log(`   3. Que las políticas de las colas permitan a SNS enviar mensajes`);
    console.log(`   4. Que el nombre del MessageAttribute sea exactamente "countryISO"`);
    console.log(`   5. Que el valor del MessageAttribute sea exactamente "PE" o "CL" (sin comillas)`);

  } catch (error) {
    console.error("\n❌ [DIAGNÓSTICO] Error en el diagnóstico:", error);
    // @ts-expect-error - process is available at runtime in Node.js
    process.exit(1);
  }
}

main();

