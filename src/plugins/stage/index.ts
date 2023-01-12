import Listener from "../listener";
import StageConfig from "./config";
import { throttleRAF } from "@/utils";
import { IPPTElement, IPPTLineElement, IPPTShapeElement } from "../types/element";
import { SHAPE_TYPE } from "../config/shapes";

export default class Stage {
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;
    public stageConfig: StageConfig;
    public container: HTMLDivElement;
    public listener: Listener;
    constructor(
        container: HTMLDivElement,
        listener: Listener,
        stageConfig: StageConfig
    ) {
        this.container = container;
        this.listener = listener;
        this.stageConfig = stageConfig;

        const { canvas, ctx } = this._createStage();

        this.ctx = ctx;
        this.canvas = canvas;
        window.addEventListener(
            "resize",
            throttleRAF(this._resetStage.bind(this))
        );
    }

    private _resetStage() {
        const width = this.stageConfig.getWidth();
        const height = this.stageConfig.getHeight();
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        const dpr = window.devicePixelRatio;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);

        this.stageConfig.resetBaseZoom();
    }

    private _createStage() {
        const width = this.stageConfig.getWidth();
        const height = this.stageConfig.getHeight();
        const canvas = document.createElement("canvas");
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.position = "absolute";
        this.container.appendChild(canvas);

        // 调整分辨率
        const dpr = window.devicePixelRatio;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(dpr, dpr);

        return { ctx, canvas };
    }

    public clear() {
        const canvasWidth = this.stageConfig.getWidth();
        const canvasHeight = this.stageConfig.getHeight();
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    public drawElement(element: IPPTElement) {
        const zoom = this.stageConfig.zoom;
        const { x, y } = this.stageConfig.getStageOrigin();

        this.ctx.save();

        // 缩放画布
        this.ctx.scale(zoom, zoom);

        if (element.type !== "line") {
            const ox = x + element.left + element.width / 2;
            const oy = y + element.top + element.height / 2;

            // 平移坐标原点
            this.ctx.translate(ox, oy);
            // 旋转画布
            this.ctx.rotate((element.rotate / 180) * Math.PI);
        } else {
            this.ctx.translate(x + element.left, y + element.top);
        }

        switch (element.type) {
            case "shape": {
                this.drawShape(element);
                break;
            }
            case "line": {
                this.drawLine(element);
                break;
            }
        }

        this.ctx.restore();
    }

    public drawLine(element: IPPTLineElement) {
        this.ctx.strokeStyle = element.color;
        this.ctx.lineWidth = element.borderWidth;
        if (element.style === "dashedPoint") {
            // 点线间隔
        } else if (element.style === "dashed") {
            this.ctx.setLineDash([8, 4]);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(...element.start);
        this.ctx.lineTo(...element.end);

        this.ctx.stroke();

        if (element.endStyle === "arrow") {
            const { point1, point2, point3 } = this.getLineArrow(element);
            this.ctx.beginPath();
            this.ctx.moveTo(...element.end);
            this.ctx.lineTo(point1[0], point1[1]);
            this.ctx.lineTo(point3[0], point3[1]);
            this.ctx.lineTo(point2[0], point2[1]);
            this.ctx.closePath();
            this.ctx.fillStyle = element.color;
            this.ctx.stroke();
            this.ctx.fill();
        }
    }

    public getLineArrow(element: IPPTLineElement) {
        const r = 4;
        const 𝜃 = 30 / 180 * Math.PI;
        const cx = element.end[0];
        const cy = element.end[1];
        const lineLen = Math.hypot(cx, cy);
        const scale = (lineLen + r) / lineLen;
        const rx = cx * scale;
        const ry = cy * scale;
        const point1 = this.stageConfig.rotate(cx, cy, rx, ry, 𝜃);
        const point2 = this.stageConfig.rotate(cx, cy, rx, ry, -𝜃);
        return { point1, point2, point3: [rx, ry] };
    }

    public drawShape(element: IPPTShapeElement) {
        this.ctx.fillStyle = element.fill;
        const path = this.getShapePath(element);
        this.ctx.fill(path);

        if (element.outline) {
            const lineWidth = element.outline.width || 2;
            this.ctx.lineWidth = lineWidth;
            this.ctx.strokeStyle = element.outline.color || "#000";
            if (element.outline.style === "dashed") {
                this.ctx.setLineDash([
                    (8 * lineWidth) / 2,
                    (4 * lineWidth) / 2
                ]);
            }
            this.ctx.stroke(path);
        }
    }

    public getShapePath(element: IPPTShapeElement) {
        const offsetX = -element.width / 2;
        const offsetY = -element.height / 2;

        const rect = {
            minX: offsetX,
            minY: offsetY,
            maxX: element.width / 2,
            maxY: element.height / 2
        };

        let path = "";

        switch (element.shape) {
            case SHAPE_TYPE.RECT: {
                path = `M${rect.minX} ${rect.minY}h${element.width}v${element.height}H${rect.minX}z`;
                break;
            }
            case SHAPE_TYPE.RECT_RADIUS: {
                const radius = Math.min(element.width, element.height) * 0.1;
                path = `M ${rect.minX + radius} ${rect.minY} L ${
                    rect.maxX - radius
                } ${rect.minY} Q ${rect.maxX} ${rect.minY} ${rect.maxX} ${
                    rect.minY + radius
                } L ${rect.maxX} ${rect.maxY - radius} Q ${rect.maxX} ${
                    rect.maxY
                } ${rect.maxX - radius} ${rect.maxY} L ${rect.minX + radius} ${
                    rect.maxY
                } Q ${rect.minX} ${rect.maxY} ${rect.minX} ${
                    rect.maxY - radius
                } L ${rect.minX} ${rect.minY + radius} Q ${rect.minX} ${
                    rect.minY
                } ${rect.minX + radius} ${rect.minY} Z`;
                break;
            }
            case SHAPE_TYPE.RECT_MINUS_SINGLE_ANGLE: {
                const len = Math.min(element.width, element.height) * 0.4;
                path = `M${rect.maxX} ${rect.minY + len}V${rect.maxY}H${
                    rect.minX
                }V${rect.minY}H${rect.maxX - len}L${rect.maxX} ${
                    rect.minY + len
                }Z`;
                break;
            }
            case SHAPE_TYPE.RECT_MINUS_SAME_SIDE_ANGLE: {
                const len = Math.min(element.width, element.height) * 0.2;
                path = `M${rect.maxX} ${rect.minY + len}V${rect.maxY}H${
                    rect.minX
                }V${rect.minY + len}L${rect.minX + len} ${rect.minY}H${
                    rect.maxX - len
                }L${rect.maxX} ${rect.minY + len}Z`;
                break;
            }
            case SHAPE_TYPE.RECT_MINUS_OPPOSITE_ANGLE: {
                const len = Math.min(element.width, element.height) * 0.2;
                path = `M${rect.maxX} ${rect.minY + len}V${rect.maxY}H${
                    rect.minX + len
                }L${rect.minX} ${rect.maxY - len}V${rect.minY}H${
                    rect.maxX - len
                }L${rect.maxX} ${rect.minY + len}Z`;
                break;
            }
            case SHAPE_TYPE.RECT_SINGLE_RADIUS_MINUS_SINGLE_ANGLE: {
                const len = Math.min(element.width, element.height) * 0.2;
                const radius = Math.min(element.width, element.height) * 0.2;
                path = `M${rect.maxX} ${rect.minY + len}V${rect.maxY}H${
                    rect.minX
                }V${rect.minY + radius}Q${rect.minX} ${rect.minY} ${
                    rect.minX + radius
                } ${rect.minY}H${rect.maxX - len}L${rect.maxX} ${
                    rect.minY + len
                }Z`;
                break;
            }
            case SHAPE_TYPE.RECT_SINGLE_RADIUS: {
                const radius = Math.min(element.width, element.height) * 0.2;
                path = `M ${rect.minX} ${rect.minY} L ${rect.maxX - radius} ${
                    rect.minY
                } Q ${rect.maxX} ${rect.minY} ${rect.maxX} ${
                    rect.minY + radius
                } L ${rect.maxX} ${rect.maxY} L ${rect.minX} ${rect.maxY} L ${
                    rect.minX
                } ${rect.minY} Z`;
                break;
            }
            case SHAPE_TYPE.RECT_SAME_SIDE_RADIUS: {
                const radius = Math.min(element.width, element.height) * 0.2;
                path = `M ${rect.minX + radius} ${rect.minY} L ${
                    rect.maxX - radius
                } ${rect.minY} Q ${rect.maxX} ${rect.minY} ${rect.maxX} ${
                    rect.minY + radius
                } L ${rect.maxX} ${rect.maxY} L ${rect.minX} ${rect.maxY} L ${
                    rect.minX
                } ${rect.minY + radius} Q ${rect.minX} ${rect.minY} ${
                    rect.minX + radius
                } ${rect.minY} Z`;
                break;
            }
            case SHAPE_TYPE.RECT_OPPOSITE_RADIUS: {
                const radius = Math.min(element.width, element.height) * 0.2;
                path = `M ${rect.minX + radius} ${rect.minY} L ${
                    rect.maxX - radius
                } ${rect.minY} Q ${rect.maxX} ${rect.minY} ${rect.maxX} ${
                    rect.minY + radius
                } L ${rect.maxX} ${rect.maxY} L ${rect.minX + radius} ${
                    rect.maxY
                } Q ${rect.minX} ${rect.maxY} ${rect.minX} ${
                    rect.maxY - radius
                } L ${rect.minX} ${rect.minY} Z`;
                break;
            }
        }

        return new Path2D(path);
    }
}