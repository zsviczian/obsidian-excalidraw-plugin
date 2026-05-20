export type PdfJsPageViewport = {
  width: number;
  height: number;
};

export type PdfJsPageProxy = {
  getViewport(options: { scale: number }): PdfJsPageViewport;
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    background: string;
    viewport: PdfJsPageViewport;
  }): { promise: Promise<void> };
  rotate?: number;
  view: [number, number, number, number];
};

export type PdfJsDocumentProxy = {
  destroy(): void;
  getPage(pageNumber: number): Promise<PdfJsPageProxy>;
  numPages: number;
};

export type PdfJsDocumentLoadResult = {
  promise: Promise<PdfJsDocumentProxy>;
};

export type PdfJsLibrary = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument(options: {
    url: string;
    wasmUrl?: string;
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
    iccUrl?: string;
  }): PdfJsDocumentLoadResult;
};
