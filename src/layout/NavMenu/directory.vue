<template>
     <div class="ppt-menu-item" @click="onClick">目录</div>
</template>

<script setup>
import emitter, { EmitterEvents } from "@/utils/emitter";


const onClick = ()=>{
    emitter.emit(EmitterEvents.OPEN_DIRECTORY)
}
</script>