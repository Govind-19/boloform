import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    DndContext,
    DragOverlay,
    useDroppable,
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    pointerWithin,
    rectIntersection,

} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragMoveEvent, CollisionDetection, UniqueIdentifier } from '@dnd-kit/core';
import Modal from './Modal';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import Sidebar from './Sidebar';
import type { FieldType } from './Sidebar';
import PlacedField from './PlacedField';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PDFViewer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    file: string;
}

interface FieldData {
    id: string;
    type: FieldType;
    x: number; // percentage (0-100)
    y: number; // percentage (0-100)
    width: number; // percentage
    height: number; // percentage
    page: number;
}

interface ActiveDragItem {
    id: UniqueIdentifier;
    type: FieldType;
    isTool: boolean;
    isPlaced: boolean;
}

// Drag overlay preview component for tools
const DragPreview: React.FC<{ type: FieldType }> = ({ type }) => {
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

    return (
        <div className="drag-preview" data-type={type}>
            <span className="field-label">
                <span className="field-icon">{getFieldIcon(type)}</span>
                {getFieldLabel(type)}
            </span>
        </div>
    );
};

// Drag overlay preview for placed fields
const PlacedFieldPreview: React.FC<{ field: FieldData; containerWidth: number }> = ({ field, containerWidth }) => {
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

    // Calculate dimensions based on actual container width
    const widthPx = (field.width / 100) * containerWidth;
    // Estimate height if unknown, roughly A4 ratio context or just use auto/min height style if possible?
    // Since we don't have exact page height here, we rely on the fact that field.height is % of page height.
    // Assuming roughly standard A4 portrait (1:1.41)
    const estimatedPageHeight = containerWidth * 1.414;
    const heightPx = (field.height / 100) * estimatedPageHeight;

    return (
        <div
            className="drag-preview placed-preview"
            data-type={field.type}
            style={{
                width: `${widthPx}px`,
                height: `${heightPx}px`,
            }}
        >
            <span className="field-label">
                <span className="field-icon">{getFieldIcon(field.type)}</span>
                {getFieldLabel(field.type)}
            </span>
        </div>
    );
};

const DroppablePage = ({
    pageNumber,
    children,
    containerWidth,
    isOver,
}: {
    pageNumber: number;
    children: React.ReactNode;
    containerWidth: number;
    isOver: boolean;
}) => {
    const { setNodeRef, isOver: dropIsOver } = useDroppable({
        id: `page-${pageNumber}`,
        data: { pageNumber },
    });

    const isActive = isOver || dropIsOver;

    return (
        <div
            ref={setNodeRef}
            className={`pdf-page-droppable ${isActive ? 'drop-active' : ''}`}
            style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}
        >
            <Page
                pageNumber={pageNumber}
                width={containerWidth || undefined}
                renderTextLayer={false}
                renderAnnotationLayer={false}
            />
            <div className="overlay-layer">
                {children}
            </div>
            {isActive && <div className="drop-indicator" />}
        </div>
    );
};

interface ModalState {
    isOpen: boolean;
    title: string;
    type: 'success' | 'error' | 'info';
    content: React.ReactNode;
    pdfUrl?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ file }) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [fields, setFields] = useState<FieldData[]>([]);
    const [activeItem, setActiveItem] = useState<ActiveDragItem | null>(null);
    const [overPageId, setOverPageId] = useState<string | null>(null);

    const [modalState, setModalState] = useState<ModalState>({
        isOpen: false,
        title: '',
        type: 'info',
        content: null,
    });

    // Optimized sensors for smooth dragging
    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: {
            distance: 5, // Reduced for quicker activation
        },
    });

    const mouseSensor = useSensor(MouseSensor, {
        activationConstraint: {
            distance: 5,
        },
    });

    const touchSensor = useSensor(TouchSensor, {
        activationConstraint: {
            delay: 150, // Reduced delay for faster touch response
            tolerance: 8, // Slightly more tolerance for finger movement
        },
    });

    const keyboardSensor = useSensor(KeyboardSensor, {});

    const sensors = useSensors(pointerSensor, mouseSensor, touchSensor, keyboardSensor);

    // Custom collision detection that works better with nested droppables
    const customCollisionDetection: CollisionDetection = useCallback((args) => {
        // First, check for pointer within collisions (most accurate for our use case)
        const pointerCollisions = pointerWithin(args);
        if (pointerCollisions.length > 0) {
            return pointerCollisions;
        }

        // Fallback to rect intersection
        const rectCollisions = rectIntersection(args);
        if (rectCollisions.length > 0) {
            return rectCollisions;
        }

        // Final fallback to closest center
        return closestCenter(args);
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const isTool = active.data.current?.isTool || false;
        const isPlaced = active.data.current?.isPlaced || false;
        const type = active.data.current?.type as FieldType;

        setActiveItem({
            id: active.id,
            type,
            isTool,
            isPlaced,
        });

        // Add dragging class to body for global cursor change
        document.body.classList.add('is-dragging');
    };

    const handleDragMove = (event: DragMoveEvent) => {
        const { over } = event;
        if (over) {
            const pageId = over.id as string;
            if (pageId.startsWith('page-')) {
                setOverPageId(pageId);
            }
        } else {
            setOverPageId(null);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        // Clean up
        setActiveItem(null);
        setOverPageId(null);
        document.body.classList.remove('is-dragging');

        if (!over) return;

        const isTool = active.data.current?.isTool;
        const isPlaced = active.data.current?.isPlaced;
        const pageId = over.id as string;

        const activeRect = active.rect.current?.translated;
        const overRect = over.rect;

        if (activeRect && overRect) {
            const relativeX = activeRect.left - overRect.left;
            const relativeY = activeRect.top - overRect.top;

            const percentX = (relativeX / overRect.width) * 100;
            const percentY = (relativeY / overRect.height) * 100;

            if (isTool) {
                const type = active.data.current?.type as FieldType;
                const defaultWidth = 20;
                const defaultHeight = 5;

                const constrainedX = Math.max(0, Math.min(100 - defaultWidth, percentX));
                const constrainedY = Math.max(0, Math.min(100 - defaultHeight, percentY));

                const newField: FieldData = {
                    id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type,
                    x: constrainedX,
                    y: constrainedY,
                    width: defaultWidth,
                    height: defaultHeight,
                    page: parseInt(pageId.split('-')[1]),
                };
                setFields((prev) => [...prev, newField]);
            } else if (isPlaced) {
                const id = active.id as string;
                setFields((prev) => prev.map((f) => {
                    if (f.id === id) {
                        const constrainedX = Math.max(0, Math.min(100 - f.width, percentX));
                        const constrainedY = Math.max(0, Math.min(100 - f.height, percentY));

                        return {
                            ...f,
                            x: constrainedX,
                            y: constrainedY,
                            page: parseInt(pageId.split('-')[1]), // Allow moving between pages
                        };
                    }
                    return f;
                }));
            }
        }
    };

    const handleDragCancel = () => {
        setActiveItem(null);
        setOverPageId(null);
        document.body.classList.remove('is-dragging');
    };

    const handleResize = (id: string, width: number, height: number) => {
        setFields((prev) => prev.map((f) => {
            if (f.id === id) {
                return { ...f, width, height };
            }
            return f;
        }));
    };

    const handleDeleteField = (id: string) => {
        setFields((prev) => prev.filter((f) => f.id !== id));
    };

    const handleSign = async () => {
        // Send all fields to backend


        try {
            // Fetch the PDF file and convert to Base64
            const pdfResponse = await fetch(file); // Assuming 'file' is the URL or path to the PDF
            const pdfBlob = await pdfResponse.blob();

            const pdfBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.readAsDataURL(pdfBlob);
            });

            const response = await fetch('/api/pdf/sign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pdfBase64, // Send the PDF content
                    pdfId: 'sample', // Still sending ID just in case
                    signatures: fields.filter(item => item.type === 'signature').map(item => ({
                        id: item.id,
                        // Assuming 'content' property exists on FieldData for signature image data
                        imageBase64: (item as any).content,
                        x: item.x,
                        y: item.y,
                        width: item.width,
                        height: item.height,
                        page: item.page,
                    })),
                    fields: fields.map(item => ({
                        id: item.id,
                        type: item.type,
                        x: item.x,
                        y: item.y,
                        width: item.width,
                        height: item.height,
                        page: item.page,
                        // Assuming 'content' property exists on FieldData for other field types
                        content: (item as any).content
                    }))
                })
            });

            const result = await response.json();

            if (result.success) {
                setModalState({
                    isOpen: true,
                    title: 'Document Signed Successfully!',
                    type: 'success',
                    content: (
                        <div>
                            <p style={{ marginBottom: '1rem', color: '#64748b' }}>
                                Your document has been secure-signed and generated.
                            </p>

                            <span className="hash-label">Original Document Hash (SHA-256)</span>
                            <div className="hash-block">{result.originalHash}</div>

                            <span className="hash-label">Signed Document Hash (SHA-256)</span>
                            <div className="hash-block">{result.signedHash}</div>


                        </div>
                    ),
                    pdfUrl: result.url,
                });
            } else {
                setModalState({
                    isOpen: true,
                    title: 'Signing Failed',
                    type: 'error',
                    content: <p>There was an issue signing your document. Please try again.</p>
                });
            }
        } catch (e) {
            console.error(e);
            setModalState({
                isOpen: true,
                title: 'Connection Error',
                type: 'error',
                content: <p>A network error occurred while trying to sign the document. Check if the server is running.</p>
            });
        }
    };

    // Get the currently dragged field data for the overlay
    const getActiveField = (): FieldData | undefined => {
        if (!activeItem || !activeItem.isPlaced) return undefined;
        return fields.find(f => f.id === activeItem.id);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="viewer-layout">
                <Sidebar onSign={handleSign} />
                <div className="pdf-workspace">
                    <div
                        className="pdf-container"
                        ref={containerRef}
                        style={{
                            maxWidth: '800px',
                            width: '100%',
                            margin: '0 auto',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}
                    >
                        <Document file={file} onLoadSuccess={onDocumentLoadSuccess} className="pdf-document">
                            {Array.from(new Array(numPages), (_, index) => {
                                const pageNumber = index + 1;
                                const pageFields = fields.filter(f => f.page === pageNumber);
                                const isPageOver = overPageId === `page-${pageNumber}`;

                                return (
                                    <div
                                        key={`page_wrapper_${pageNumber}`}
                                        className="pdf-page-wrapper"
                                    >
                                        <DroppablePage
                                            key={`page_${pageNumber}`}
                                            pageNumber={pageNumber}
                                            containerWidth={containerWidth}
                                            isOver={isPageOver}
                                        >
                                            {pageFields.map((field) => (
                                                <PlacedField
                                                    key={field.id}
                                                    {...field}
                                                    containerWidth={containerWidth}
                                                    containerHeight={0}
                                                    onResize={handleResize}
                                                    onDelete={handleDeleteField}
                                                    isDragging={activeItem?.id === field.id}
                                                />
                                            ))}
                                        </DroppablePage>
                                    </div>
                                );
                            })}
                        </Document>
                    </div>
                </div>
            </div>

            {/* Drag Overlay for smooth dragging visuals */}
            <DragOverlay
                dropAnimation={{
                    duration: 200,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}
                modifiers={[restrictToWindowEdges]}
            >
                {activeItem ? (
                    activeItem.isTool ? (
                        <DragPreview type={activeItem.type} />
                    ) : activeItem.isPlaced ? (
                        <PlacedFieldPreview field={getActiveField()!} containerWidth={containerWidth} />
                    ) : null
                ) : null}
            </DragOverlay>

            <Modal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                type={modalState.type}
                actions={
                    <>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                        >
                            Close
                        </button>
                        {modalState.pdfUrl && (
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    if (modalState.pdfUrl) {
                                        // Convert Data URI to Blob to avoid "Not allowed to navigate top frame to data URL"
                                        try {
                                            const dataUri = modalState.pdfUrl;
                                            if (dataUri.startsWith('data:application/pdf;base64,')) {
                                                const base64 = dataUri.split(',')[1];
                                                const binaryString = window.atob(base64);
                                                const len = binaryString.length;
                                                const bytes = new Uint8Array(len);
                                                for (let i = 0; i < len; i++) {
                                                    bytes[i] = binaryString.charCodeAt(i);
                                                }
                                                const blob = new Blob([bytes], { type: 'application/pdf' });
                                                const blobUrl = URL.createObjectURL(blob);
                                                window.open(blobUrl, '_blank');
                                            } else {
                                                window.open(dataUri, '_blank');
                                            }
                                        } catch (e) {
                                            console.error("Error opening PDF blob", e);
                                            window.open(modalState.pdfUrl, '_blank');
                                        }
                                    }
                                }}
                            >
                                Open Signed PDF
                            </button>
                        )}
                    </>
                }
            >
                {modalState.content}
            </Modal>
        </DndContext>
    );
};

export default PDFViewer;
