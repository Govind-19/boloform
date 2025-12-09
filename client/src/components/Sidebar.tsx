import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import '../App.css';

export type FieldType = 'text' | 'signature' | 'date' | 'image' | 'radio';

interface DraggableToolProps {
    type: FieldType;
    label: string;
    icon: string;
}

const DraggableTool: React.FC<DraggableToolProps> = ({ type, label, icon }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: `tool-${type}`,
        data: { type, isTool: true },
    });

    // Optimized transform with GPU acceleration
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        willChange: isDragging ? 'transform' : 'auto',
        touchAction: 'none', // Prevents touch scrolling interference
    };

    const toolClasses = [
        'draggable-tool',
        isDragging ? 'tool-dragging' : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            ref={setNodeRef}
            className={toolClasses}
            style={style}
            {...listeners}
            {...attributes}
            data-type={type}
        >
            <span className="tool-icon">{icon}</span>
            <span className="tool-label">{label}</span>
        </div>
    );
};

interface SidebarProps {
    onSign: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onSign }) => {
    return (
        <aside className="sidebar" role="complementary" aria-label="Form field tools">
            <h3>Drag & Drop Fields</h3>
            <div className="tools-container" role="list" aria-label="Available field types">
                <DraggableTool type="text" label="Text Field" icon="T" />
                <DraggableTool type="signature" label="Signature" icon="S" />
                <DraggableTool type="date" label="Date" icon="D" />
                <DraggableTool type="image" label="Image" icon="I" />
                <DraggableTool type="radio" label="Radio Group" icon="R" />
            </div>

            <div className="sidebar-footer">
                <button
                    className="sign-button"
                    onClick={onSign}
                    aria-label="Sign the document"
                >
                    Sign Document
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
