<template>
    <div class="ppt-container">
        <div class="ppt-toolbar">
            <NavMenu
                :elements="currentElements"
                :slideFocus="slideFocus"
                :current="slideIndex"
                @onPreview="startPreview"
            />
            <Tools :elements="currentElements" />
        </div>
        <div class="ppt-body">
            <
            <ThumbnailList
                :switchSlide="switchSlide"
                :deleteSlide="deleteSlide"
                :cutSlide="cutSlide"
                :copySlide="copySlide"
                :pasteSlide="pasteSlide"
                :onSelectedSlide="onSelectedSlide"
            />
            
            <div class="ppt-content" ref="pptRef" @focus="onCanvasFocus">
                <div
                    class="ppt-no-slide"
                    v-if="viewSlides.length === 0"
                    @click="addPPT()"
                >
                    <div
                        class="ppt-add-slide"
                        :style="{
                            transform: `scale(${zoom}) translate(-50%, -50%)`
                        }"
                    >
                        点击此处添加第一张幻灯片
                    </div>
                </div>
            </div>
            <div class="ppt-panel-box" :class="showPanel && 'active'">
                <Panels :visible="showPanel" :elements="currentElements" />
            </div>
        </div>
        <div class="ppt-footer">
            <Footer
                :total="total"
                :current="slideIndex"
                @onZoomChange="resize"
                @onPreview="startPreview"
            />
        </div>

        <ScreenView
            v-if="showPreview"
            :slides="viewSlides"
            :startSlideIndex="startSlideIndex"
            @endPreview="endPreview"
        />

        <div class="loading-fullscreen" v-if="loading">
            <div class="loading-box">
                <a-spin size="large"></a-spin>
                <a-progress
                    :strokeWidth="16"
                    :percent="percent"
                    status="active"
                    :show-info="false"
                />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, provide, ref } from "vue";
import NavMenu from "./layout/NavMenu/index.vue";
import Tools from "./layout/Tools/index.vue";
import ThumbnailList from "./layout/ThumbnailList.vue";
import Footer from "./layout/Footer.vue";
import Panels from "./layout/Panels/index.vue";
import ScreenView from "./layout/ScreenView.vue";
import Editor from "./plugins/editor";
import { slides } from "./mock";
import emitter, { EmitterEvents } from "./utils/emitter";
import { enterFullScreen, isFullScreen, exitFullScreen } from "./utils";
import useSlideHandler from "@/hooks/useSlideHandler";
import { ISlide } from "./types/slide";
import { IPPTElement } from "./types/element";
import { message } from "ant-design-vue";
import isElectron from "is-electron";
import { ipcRenderer } from "electron";
import useImport from "./hooks/useImport";
import DB from "./utils/db";


const nodePath = require('path');
// const ini = require('ini');


const pptRef = ref<HTMLDivElement>();
const zoom = ref(1);
const instance = ref<Editor>();
const viewSlides = ref<ISlide[]>([]);
const total = computed(() => viewSlides.value.length);

const historyCursor = ref(0);
const historyLength = ref(0);

const mergeDisabled = ref(true);
const splitDisabled = ref(true);

const showPanel = ref(false);
const showPreview = ref(false);

let lastSelectedTime = 0
const min_selected_interval = 150

const db = new DB()

provide("instance", instance);
provide("historyCursor", historyCursor);
provide("historyLength", historyLength);
provide("mergeDisabled", mergeDisabled);
provide("splitDisabled", splitDisabled);

const {
    slideIndex,
    selectedSlideId,
    initSlide,
    addPPT,
    onSelectedSlide,
    switchSlide,
    cutSlide,
    copySlide,
    pasteSlide,
    deleteSlide
} = useSlideHandler(instance, viewSlides, historyCursor, historyLength);

const slideFocus = ref(false);

provide("selectedSlideId", selectedSlideId);
provide("slideIndex", slideIndex);
provide("slideFocus", slideFocus);
provide("viewSlides", viewSlides);

const onCanvasFocus = () => {
    slideFocus.value = false;
};

const currentElements = ref<IPPTElement[]>([]);

const openPanel = (show: boolean) => {
    showPanel.value = show;
};

const onDirectoty = async ()=>{
    console.log('onDirectoty')

}

const params = new URLSearchParams(location.search);
const path = params.get("path");

 const createAudioTemp=(id: string, file: string) =>{
        const audio = document.createElement("audio");
        audio.id = id;
        audio.src = file;
        audio.style.visibility = "visible";
        audio.style.position = "absolute";
        audio.style.zIndex = "-1000";
        document.body.appendChild(audio);
        return audio;
    }

nextTick(async () => {
    if (pptRef.value) {
        // 是否是开发环境 开发环境加载mock或db中数据
        const isDev = process.env.NODE_ENV === "development";

        instance.value = new Editor(pptRef.value, isElectron() && !isDev ? [] : slides);

        if (!isDev) {
            // electron清空db数据
            await instance.value?.history.getHistorySnapshot();
            await instance.value?.history.clear();
        }

        if (!path) hideLoading();
        // 设置初始化页面
        initSlide();

        // 编辑监听
        instance.value.listener.onEditChange = (cursor, length, slideId) => {
            historyCursor.value = cursor;
            historyLength.value = length;
            viewSlides.value = instance.value!.stageConfig.slides;
            if (slideId && slideId !== selectedSlideId.value) {
                // id不相等切换页
                const updateSlide = viewSlides.value.find(
                    (slide) => slide.id === selectedSlideId.value
                );
                if (updateSlide) {
                    emitter.emit(EmitterEvents.UPDATE_THUMBNAIL, updateSlide);
                }
                onSelectedSlide(slideId);
            }
            const updateSlide = viewSlides.value.find(
                (slide) => slide.id === slideId
            );
            if (updateSlide) {
                emitter.emit(EmitterEvents.UPDATE_THUMBNAIL, updateSlide);
            }
        };

        instance.value.listener.onUpdateThumbnailSlide = (slide) => {
            emitter.emit(EmitterEvents.UPDATE_THUMBNAIL, slide);
        };

        instance.value.listener.onSelectedChange = (
            elements: IPPTElement[]
        ) => {
            const newSelectedTime = new Date().getMilliseconds()
            if(newSelectedTime - lastSelectedTime<min_selected_interval){
                return
            }
            currentElements.value = elements;
            console.log('listener.onSelectedChange',elements)
            if(elements.length>0){
                const target  = elements[0]
                if(target.type === 'audio' && target.src){
                    const id_temp = `${target.id}_temp`
                    let audioEle =  document.getElementById(id_temp) as HTMLMediaElement|undefined
                    if(!audioEle){
                        
                        db.getFile(target.src).then((file:string)=>{
                            console.log('listener.onSelectedChange,getFile succ',elements)
                            audioEle = createAudioTemp(id_temp,file)
                            audioEle.addEventListener('canplay',()=>{
                                console.log('listener.onSelectedChange,canplay',elements)
                                audioEle?.play()
                              })
                            
                        }).catch(err=>{
                            console.error('listener.onSelectedChange,getFile error',err)
                        })
                    }else{
                        if(audioEle?.paused){
                            console.log('listener.onSelectedChange,play')
                            audioEle?.play()
                        }else{
                            console.log('listener.onSelectedChange,pause')
                            audioEle?.pause()
                       }
                    }
                   
                    
                    
                    
                }   
                
            }
        };

        instance.value.listener.onTableCellEditChange = (merge, split) => {
            mergeDisabled.value = merge;
            splitDisabled.value = split;
        };

        emitter.on(EmitterEvents.INIT_SLIDE, initSlide);
        emitter.on(EmitterEvents.ADD_EMPTY_SLIDE, addPPT);
        emitter.on(EmitterEvents.COPY_SLIDE, copySlide);
        emitter.on(EmitterEvents.CUT_SLIDE, cutSlide);
        emitter.on(EmitterEvents.DELETE_SLIDE, deleteSlide);
        emitter.on(EmitterEvents.PASTE_SLIDE, pasteSlide);
        emitter.on(EmitterEvents.PASTE_SLIDE, pasteSlide);
        emitter.on(EmitterEvents.OPEN_DIRECTORY, onDirectoty);
        
    }

    emitter.on(EmitterEvents.SHOW_PANELS, openPanel);

    // onLoadFile();
});

// 暂存文件路径，为了后面保存使用
const storePath = ref("");
provide("storePath", storePath);
const loading = ref(false);
const percent = ref(0);
const { importMPPTX } = useImport(instance, loading, percent);
const onLoadFile = async (externalePath?:string) => {
    console.log('onLoadFile,path = ',path)
    // message.info(`onLoadFile:${path}`)
    if (isElectron()) {
       
        let finalPath = ""
        if(externalePath){
            finalPath = externalePath
        }else if(path){
            finalPath = path
        }else{
             // const defaultFile = nodePath.join(process.cwd(),'/public/mpptx_slides.mpptx')
            const defaultPath = ""
            console.log('onLoadFile,default path = ',defaultPath)
            finalPath = defaultPath
        }
       
        // if(path){  
        //     console.log(`use history path:${path}`)
        //     storePath.value = path;
        // }else{

        //     console.log(`use default path:${defaultPath}`)
        // }
        if(finalPath){
            message.info(`正在打开文件:${path}`)
            const file = window.electron.readFile(finalPath);
            await importMPPTX(file)
        }  
    }
    hideLoading();
};

const hideLoading = () => {
    const loading = document.getElementById("startLoadingContainer");
    loading?.remove();
};

const resize = (scale: number) => {
    zoom.value = scale / 100;
};

const startSlideIndex = ref(0);
const startPreview = (slideIndex: number) => {
    if (viewSlides.value.length === 0) {
        message.warning("请添加幻灯片");
    } else {
        startSlideIndex.value = slideIndex;
        showPreview.value = true;
        enterFullScreen();
    }
};

const outFullScreen = () => {
    if (!isFullScreen()) {
        showPreview.value = false;
    }
};

const endPreview = () => {
    if (showPreview.value) {
        showPreview.value = false;
        exitFullScreen();
    }
};

onMounted(() => {
    window.addEventListener("resize", outFullScreen);
    ipcRenderer.on("esc", endPreview);
    ipcRenderer.send('query-path');
    ipcRenderer.on('query-path-replay',(_,filePath?:string)=>{
        console.log('--query-path-replay--',filePath)
        if (filePath && filePath.endsWith('.mpptx')) {
            console.log('open file with init',filePath)
            onLoadFile(filePath)
        }
    })

    // setTimeout(() => {

    //   const rootPath = process.cwd()
    //   const filePath = nodePath.join(rootPath,'/public/mpptx_slides.mpptx')
    //   console.log('onMounted path',filePath)
    //   importMPPTX( window.electron.readFile(filePath)).then(()=>{
    //     hideLoading()
    //   })

    // }, 5000);
});

onUnmounted(() => {
    emitter.off(EmitterEvents.INIT_SLIDE, initSlide);
    emitter.off(EmitterEvents.ADD_EMPTY_SLIDE, addPPT);
    emitter.off(EmitterEvents.COPY_SLIDE, copySlide);
    emitter.off(EmitterEvents.CUT_SLIDE, cutSlide);
    emitter.off(EmitterEvents.DELETE_SLIDE, deleteSlide);
    emitter.off(EmitterEvents.PASTE_SLIDE, pasteSlide);
    emitter.off(EmitterEvents.SHOW_PANELS, openPanel);
    emitter.off(EmitterEvents.OPEN_DIRECTORY, onDirectoty);

    window.removeEventListener("resize", outFullScreen);
    ipcRenderer.off("esc", endPreview);
});
</script>

<style lang="scss" scoped>
.ppt-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background-color: #eee;
    z-index: 1;
}

.ppt-no-slide {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 100;
    width: 100%;
    height: 100%;
    background-color: #eee;
    .ppt-add-slide {
        border: 1px dashed #555555;
        width: 1000px;
        height: 562.5px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 50px;
        position: absolute;
        top: 50%;
        left: 50%;
        cursor: pointer;
        transform-origin: top left;
    }
}

.ppt-toolbar {
    height: 62px;
    background-color: #f7f7f7;
}

.ppt-body {
    flex: 1;
    min-height: 0;
    display: flex;
    .ppt-content {
        flex: 1;
        min-width: 0;
        position: relative;
    }

    .ppt-panel-box {
        width: 0;
        transition: all .3s;
        position: relative;
        &.active {
            width: 284px;
        }
    }
}

.ppt-footer {
    height: 32px;
    background-color: #e9e9e9;
    border-top: 1px solid rgba(65, 70, 75, 0.1);
}
</style>
