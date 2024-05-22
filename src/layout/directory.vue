<template>
    <a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible>
        <a-menu >
            
        </a-menu>
    </a-layout-sider>
</template>

<script setup>
import { ref } from 'vue';

const collapsed = ref(true)
</script>