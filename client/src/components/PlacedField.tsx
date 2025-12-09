import React, { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import './PDFViewer.css';

interface PlacedFieldProps {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    onResize: (id: string, width: number, height: number) => void;
    onDelete?: (id: string) => void;
    containerWidth: number;
    containerHeight: number;
    isDragging?: boolean;
}

const PlacedField: React.FC<PlacedFieldProps> = ({
    id,
    type,
    x,
    y,
    width,
    height,
    onResize,
    onDelete,
    isDragging = false,
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging: localIsDragging } = useDraggable({
        id: id,
        data: { type, isPlaced: true, id },
    });

    const fieldRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Combine transform with will-change for GPU acceleration
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: height ? `${height}%` : 'auto',
        opacity: isDragging || localIsDragging ? 0.5 : 1,
        willChange: localIsDragging ? 'transform' : 'auto',
    };

    const onResizePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Stop propagation to dnd-kit
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidthPc = width;
        const startHeightPc = height;

        const pageContainer = fieldRef.current?.closest('.pdf-page-droppable') as HTMLElement;
        if (!pageContainer) return;

        const parentWidth = pageContainer.clientWidth;
        const parentHeight = pageContainer.clientHeight;

        const onPointerMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            // Simple rAF throttling
            requestAnimationFrame(() => {
                const deltaX = moveEvent.clientX - startX;
                const deltaY = moveEvent.clientY - startY;

                const deltaWidthPc = (deltaX / parentWidth) * 100;
                const deltaHeightPc = (deltaY / parentHeight) * 100;

                const maxWidth = 100 - x;
                const maxHeight = 100 - y;

                const newWidth = Math.min(maxWidth, Math.max(5, startWidthPc + deltaWidthPc));
                const newHeight = Math.min(maxHeight, Math.max(2, startHeightPc + deltaHeightPc));

                onResize(id, newWidth, newHeight);
            });
        };

        const onPointerUp = () => {
            setIsResizing(false);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.body.style.cursor = '';
        };

        document.body.style.cursor = 'se-resize';
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    };

    const handleDelete = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
        e.stopPropagation();
        // e.preventDefault(); // Sometimes prevents click?
        if (onDelete) {
            onDelete(id);
        }
    };

    const getFieldIcon = (fieldType: string): string => {
        const icons: Record<string, string> = {
            text: 'T',
            signature: 'S',
            date: 'D',
            image: 'I',
            radio: 'R',
        };
        return icons[fieldType] || fieldType.charAt(0).toUpperCase();
    };

    const getFieldLabel = (fieldType: string): string => {
        const labels: Record<string, string> = {
            text: 'Text',
            signature: 'Sign',
            date: 'Date',
            image: 'Image',
            radio: 'Radio',
        };
        return labels[fieldType] || fieldType;
    };

    const fieldClasses = [
        'draggable-field',
        localIsDragging ? 'dragging' : '',
        isResizing ? 'resizing' : '',
        isHovered ? 'hovered' : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={fieldClasses}
            data-type={type}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div ref={fieldRef} className="field-inner">
                <span className="field-label">
                    <span className="field-icon">{getFieldIcon(type)}</span>
                    {getFieldLabel(type)}
                </span>

                {/* Delete button - shown on hover */}
                {onDelete && (isHovered || isResizing) && (
                    <button
                        className="field-delete-btn"
                        onClick={handleDelete}
                        onTouchEnd={handleDelete}
                        aria-label="Delete field"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                )}

                {/* Resize handle */}
                <div
                    className="resize-handle"
                    onPointerDown={onResizePointerDown}
                    aria-label="Resize field"
                />
            </div>
        </div>
    );
};

export default PlacedField;
