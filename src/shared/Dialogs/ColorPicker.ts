import ExcalidrawView from "src/view/ExcalidrawView";
import { getViewColorPalette } from "src/utils/excalidrawViewUtils";

type PaletteName = "canvasBackground"|"elementBackground"|"elementStroke";

const GRID_COLUMNS = 5;
const CELL_SIZE = 32;
const CELL_GAP = 8;
const POPUP_PADDING = 12;
const MAX_HEIGHT = 260;

const getColors = (palette: PaletteName, view?: ExcalidrawView, includeSceneColors: boolean = false): string[] => {
	const raw = getViewColorPalette(palette, view, includeSceneColors) ?? [];
	const flattened: string[] = [];

	raw.forEach((entry: any) => {
		if (Array.isArray(entry)) {
			entry.forEach((color) => {
				if (typeof color === "string" && color) {
					flattened.push(color);
				}
			});
		} else if (typeof entry === "string" && entry) {
			flattened.push(entry);
		}
	});

	return flattened;
};

const positionPopup = (popup: HTMLElement, anchor: HTMLElement) => {
	const rect = anchor.getBoundingClientRect();
	const { innerWidth, innerHeight } = window;
	const popupWidth = popup.offsetWidth || (GRID_COLUMNS * (CELL_SIZE + CELL_GAP)) + POPUP_PADDING * 2;
	const popupHeight = popup.offsetHeight || MAX_HEIGHT + POPUP_PADDING * 2;

	let left = rect.left;
	let top = rect.bottom + 8;

	if (left + popupWidth > innerWidth - 8) {
		left = Math.max(8, innerWidth - popupWidth - 8);
	}

	if (top + popupHeight > innerHeight - 8) {
		top = Math.max(8, rect.top - popupHeight - 8);
	}

	popup.style.left = `${left}px`;
	popup.style.top = `${top}px`;
};

const attachOutsideHandlers = (
	overlay: HTMLElement,
	popup: HTMLElement,
	resolve: (color: string | null) => void,
) => {
	const stopPropagation = (evt: Event) => evt.stopPropagation();
	let cleanup: (color: string | null) => void;

	const onKeyDown = (evt: KeyboardEvent) => {
		if (evt.key === "Escape") {
			evt.stopPropagation();
			cleanup(null);
		}
	};

	const onOverlayClick = () => cleanup(null);

	cleanup = (color: string | null) => {
		document.removeEventListener("keydown", onKeyDown, true);
		overlay.removeEventListener("click", onOverlayClick);
		popup.removeEventListener("click", stopPropagation);
		overlay.remove();
		resolve(color);
	};

	document.addEventListener("keydown", onKeyDown, true);
	overlay.addEventListener("click", onOverlayClick);
	popup.addEventListener("click", stopPropagation);

	return cleanup;
};

export const showColorPicker = async (
	palette: PaletteName,
	anchorElement: HTMLElement,
	view?: ExcalidrawView,
	includeSceneColors: boolean = false,
): Promise<string | null> => {
	const colors = getColors(palette, view, includeSceneColors);

	if (!colors.length) {
		return null;
	}

	return new Promise((resolve) => {
		const overlay = document.createElement("div");
		overlay.classList.add("excalidraw-colorpicker-overlay");

		const popup = document.createElement("div");
		popup.classList.add("excalidraw-colorpicker-popup");

		const grid = document.createElement("div");
		grid.classList.add("excalidraw-colorpicker-grid");
		grid.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, ${CELL_SIZE}px)`;
		grid.style.gap = `${CELL_GAP}px`;
		grid.style.maxHeight = `${MAX_HEIGHT}px`;

		colors.forEach((color) => {
			const swatch = document.createElement("button");
			swatch.type = "button";
			swatch.ariaLabel = color;
			swatch.classList.add("excalidraw-colorpicker-swatch");
			swatch.style.backgroundColor = color;
			swatch.addEventListener("click", () => cleanup(color));
			grid.appendChild(swatch);
		});

		popup.appendChild(grid);
		overlay.appendChild(popup);
		document.body.appendChild(overlay);

		positionPopup(popup, anchorElement);

		const cleanup = attachOutsideHandlers(overlay, popup, resolve);
	});
};
