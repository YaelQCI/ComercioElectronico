<script setup>
defineProps({ caption: { type: String, required: true }, columns: { type: Array, required: true }, rows: { type: Array, required: true }, rowKey: { type: String, default: 'id' }, emptyText: { type: String, default: 'No hay registros.' } })
</script>
<template>
  <div class="max-w-full overflow-x-auto rounded-sm border border-border" tabindex="0" role="region" :aria-label="caption">
    <table class="w-full border-collapse text-left text-body-s">
      <caption class="p-4 text-left font-semibold">{{ caption }}</caption>
      <thead class="bg-surface-2"><tr><th v-for="column in columns" :key="column.key" scope="col" class="border-b border-line p-3">{{ column.label }}</th></tr></thead>
      <tbody>
        <tr v-for="row in rows" :key="row[rowKey]" class="border-b border-line last:border-0">
          <td v-for="column in columns" :key="column.key" class="p-3" :class="column.numeric ? 'font-mono tabular-nums' : ''"><slot :name="column.key" :row="row" :value="row[column.key]">{{ row[column.key] }}</slot></td>
        </tr>
        <tr v-if="!rows.length"><td :colspan="columns.length" class="p-4 text-ink-2">{{ emptyText }}</td></tr>
      </tbody>
    </table>
  </div>
</template>
