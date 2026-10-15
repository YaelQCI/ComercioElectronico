<script setup>
const route=useRoute()
const orderId=ref(typeof route.query.pedido==='string'?route.query.pedido:''),credential=ref(''),data=ref(null),selected=ref([]),type=ref('RETURN'),reason=ref('VOLUNTARY'),condition=ref('SEALED'),description=ref(''),url=ref(''),evidenceDescription=ref(''),comparison=reactive({}),busy=ref(false),failure=ref(''),message=useConfirmationMessage()
const labels={REQUESTED:'Solicitada',APPROVED:'Aprobada',REJECTED:'Rechazada',RECEIVED:'Recibida',RESOLVED:'Resuelta',PROCESSING:'En proceso',SETTLED:'Liquidado',FAILED:'Fallido',REQUIRES_REVIEW:'Requiere revisión'}
async function run(action){
  busy.value=true;message.value='';failure.value=''
  try{
    const body={action,orderId:orderId.value,guestToken:credential.value||undefined}
    if(action==='request')Object.assign(body,{type:type.value,idempotencyKey:crypto.randomUUID(),unitIds:selected.value,reason:reason.value,condition:condition.value,description:description.value,evidence:[{url:url.value,description:evidenceDescription.value}],comparison:selected.value.map(unitId=>({unitId,itemCents:comparison[unitId]?.price??'',shippingCents:comparison[unitId]?.shipping??''}))})
    const result=await $fetch('/api/after-sales',{method:'POST',body})
    if(action==='list'){data.value=result;selected.value=[];for(const u of result.units)comparison[u.id]??={price:'',shipping:''}}
    else{message.value=`Solicitud registrada: ${result.id}. Pendiente de revisión administrativa.`;data.value=await $fetch('/api/after-sales',{method:'POST',body:{action:'list',orderId:orderId.value,guestToken:credential.value||undefined}})}
  }catch(e){failure.value=e.data?.statusMessage??'No pudimos procesar la solicitud.'}finally{busy.value=false}
}
</script>
<template>
  <section class="mx-auto max-w-3xl space-y-6 px-6 py-12">
    <h1 class="text-3xl font-bold">Solicitudes del pedido</h1>
    <p>Consulta tus devoluciones y solicitudes de Price Match. Cada solicitud requiere revisión de la tienda y evidencia. No envíes productos antes de recibir instrucciones de retorno.</p>
    <form class="space-y-3" @submit.prevent="run('list')">
      <label class="block">Identificador del pedido<input v-model="orderId" required class="block w-full rounded border p-2" /></label>
      <label class="block">Credencial del pedido (para invitados)<input v-model="credential" type="password" autocomplete="off" class="block w-full rounded border p-2" /></label>
      <button :disabled="busy" class="rounded border px-4 py-2">Consultar pedido</button>
    </form>
    <p v-if="failure" role="alert" class="text-crit">{{ failure }}</p>
    <template v-if="data">
      <h2 class="text-xl font-bold">Pedido {{ data.number }}</h2>
      <form class="space-y-4" @submit.prevent="run('request')">
        <label class="block">Solicitud<select v-model="type" class="block rounded border p-2"><option value="RETURN">Devolución</option><option value="PRICE_MATCH">Price Match</option></select></label>
        <fieldset><legend>Unidades del pedido</legend><label v-for="unit in data.units" :key="unit.id" class="block py-2"><input v-model="selected" type="checkbox" :value="unit.id" :disabled="unit.returned" /> {{ unit.name }} · {{ unit.sku }} · {{ unit.id }} {{ unit.returned ? '(ya recibida)' : '' }}</label></fieldset>
        <template v-if="type==='RETURN'">
          <p>Plazo de solicitud: hasta treinta días desde entrega. Voluntarias: producto sin abrir y sello intacto.</p>
          <label class="block">Motivo<select v-model="reason" class="block rounded border p-2"><option value="VOLUNTARY">Voluntaria</option><option value="DAMAGED_ON_RECEIPT">Daño al recibir</option><option value="BROKEN_SEAL">Sello roto al recibir</option><option value="WRONG_LOT">Lote incorrecto</option></select></label>
          <label class="block">Condición reportada<select v-model="condition" class="block rounded border p-2"><option value="SEALED">Sellado</option><option value="OPENED">Abierto</option><option value="DAMAGED">Dañado</option><option value="WRONG_LOT">Lote incorrecto</option><option value="UNVERIFIABLE">Por verificar</option></select></label>
        </template>
        <template v-else>
          <p>Dentro de siete días desde compra, para la misma variante. Incluye precio competidor y envío a México por cada unidad. Importes en centavos: 10000 equivale a $100.00 MXN.</p>
          <fieldset v-for="id in selected" :key="id"><legend>Unidad {{ id }}</legend><label class="block">Precio competidor (centavos)<input v-model="comparison[id].price" required inputmode="numeric" pattern="[0-9]+" class="block rounded border p-2" /></label><label class="block">Envío asignado a esta unidad (centavos)<input v-model="comparison[id].shipping" required inputmode="numeric" pattern="[0-9]+" class="block rounded border p-2" /></label></fieldset>
        </template>
        <label class="block">Descripción<textarea v-model="description" required maxlength="4000" class="block w-full rounded border p-2" /></label>
        <label class="block">Enlace HTTPS de evidencia<input v-model="url" required type="url" class="block w-full rounded border p-2" /></label>
        <label class="block">Descripción de evidencia<input v-model="evidenceDescription" required maxlength="500" class="block w-full rounded border p-2" /></label>
        <button :disabled="busy||!selected.length" class="rounded border px-4 py-2">Registrar solicitud</button>
      </form>
      <h2 class="text-xl font-bold">Seguimiento</h2>
      <p v-if="!data.returns.length&&!data.priceMatches.length">Aún no hay solicitudes.</p>
      <article v-for="claim in [...data.returns,...data.priceMatches]" :key="claim.id" class="rounded border p-4"><p>{{ claim.id }} · {{ labels[claim.status] }}</p><p>{{ claim.decision }}</p><p v-for="refund in claim.refunds" :key="refund.id">Reintegro {{ refund.id }} · {{ labels[refund.status] }}</p></article>
    </template>
  </section>
</template>
<style scoped>
input,select,textarea { background:var(--t-surface); color:var(--t-ink); min-height:44px; }
input[type=checkbox] { width:44px; vertical-align:middle; }
input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible { outline:2px solid currentColor; outline-offset:3px; }
button { min-height:44px; }
button:disabled { opacity:.5; }
</style>
