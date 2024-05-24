<template>
    <a-form v-model="formState">
    <a-form-item label="课堂效果" name="class">
       <a-textarea v-model:value="formState.desc" />
    </a-form-item>

    <a-form-item label="学生反馈" name="feedback">
       <a-textarea v-model:value="formState.desc" />
    </a-form-item>

    <a-form-item label="学生吸收" name="stu">
       <a-textarea v-model:value="formState.desc" />
    </a-form-item>
    <a-form-item label="总体评价" name="rate">
        <a-rate v-model:value="value" />
    </a-form-item>
    </a-form>
</template>

<script setup>
import { reactive } from 'vue';



 const formState = reactive({
    class:"无",
    feedback:"无",
    stu:"无",
    rate:3,
 })
</script>