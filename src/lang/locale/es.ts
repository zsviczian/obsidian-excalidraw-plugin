import {
  DEVICE,
  FRONTMATTER_KEYS,
  CJK_FONTS,
} from "src/constants/constants";
import { TAG_AUTOEXPORT, TAG_MDREADINGMODE, TAG_PDFEXPORT } from "src/constants/constSettingsTags";
import { labelALT, labelCTRL, labelMETA, labelSHIFT } from "src/utils/modifierkeyHelper";

declare const PLUGIN_VERSION:string;

// Español
export default {
  // Sugester
  SELECT_FILE_TO_INSERT: "Selecciona un archivo para insertar",
  // main.ts
  CONVERT_URL_TO_FILE: "Guardar imagen desde el URL en un archivo local",
  UNZIP_CURRENT_FILE: "Descomprimir el archivo Excalidraw actual",
  ZIP_CURRENT_FILE: "Comprimir el archivo Excalidraw actual",
  PUBLISH_SVG_CHECK: "Obsidian Publish: Buscar exportaciones SVG y PNG desactualizadas",
  EMBEDDABLE_PROPERTIES: "Propiedades de Elementos Incrustados",
  EMBEDDABLE_RELATIVE_ZOOM: "Escalar Elementos Incrustados seleccionados al 100% con respecto al zoom actual del lienzo",
  OPEN_IMAGE_SOURCE: "Abrir bosquejo de Excalidraw",
  INSTALL_SCRIPT: "Instalar script",
  UPDATE_SCRIPT: "Actualización disponible - Click aquí para instalar",
  CHECKING_SCRIPT:
    "Buscando versión más reciente - Click aquí para reinstalar",
  UNABLETOCHECK_SCRIPT:
    "Fallo en la verificación de actualización - Click aquí para reinstalar",
  UPTODATE_SCRIPT:
    "Script actualizado - Click aquí para reinstalar",
  OPEN_AS_EXCALIDRAW: "Abrir como bosquejo de Excalidraw",
  TOGGLE_MODE: "Alternar entre modo Excalidraw y Markdown",
  DUPLICATE_IMAGE: "Duplicar imagen seleccionada con un ID de imagen diferente",
  CONVERT_NOTE_TO_EXCALIDRAW: "Convertir nota markdown en un bosquejo de Excalidraw",
  CONVERT_EXCALIDRAW: "Convertir archivos *.excalidraw al formato *.md ",
  CREATE_NEW: "Nuevo Bosquejo",
  CONVERT_FILE_KEEP_EXT: "*.excalidraw => *.excalidraw.md",
  CONVERT_FILE_REPLACE_EXT: "*.excalidraw => *.md (compatibilidad con Logseq)",
  DOWNLOAD_LIBRARY: "Exportar librería de plantillas como archivo *.excalidrawlib",
  OPEN_EXISTING_NEW_PANE: "Abrir bosquejo existente - EN UN PANEL NUEVO",
  OPEN_EXISTING_ACTIVE_PANE:
    "Abrir bosquejo existente - EN EL PANEL ACTIVO ACTUAL",
  TRANSCLUDE: "Incrustar un bosquejo",
  TRANSCLUDE_MOST_RECENT: "Incrustar el bosquejo editado más recientemente",
  TOGGLE_LEFTHANDED_MODE: "Alternar modo para zurdos",
  TOGGLE_SPLASHSCREEN: "Mostrar pantalla de bienvenida en bosquejos nuevos",
  FLIP_IMAGE: "Abrir el reverso-de-la-nota para la imagen seleccionada en una ventana emergente",
  NEW_IN_NEW_PANE: "Crear nuevo bosquejo - EN UNA VENTANA ADYACENTE",
  NEW_IN_NEW_TAB: "Crear nuevo bosquejo - EN UNA PESTAÑA NUEVA",
  NEW_IN_ACTIVE_PANE: "Crear nuevo bosquejo - EN LA VENTANA ACTIVA ACTUAL",
  NEW_IN_POPOUT_WINDOW: "Crear nuevo bosquejo - EN UNA VENTANA EMERGENTE",
  NEW_IN_NEW_PANE_EMBED:
    "Crear nuevo bosquejo - EN UNA VENTANA ADYACENTE - e incrustar en el documento activo",
  NEW_IN_NEW_TAB_EMBED:
    "Crear nuevo bosquejo - EN UNA PESTAÑA NUEVA - e incrustar en el documento activo",
  NEW_IN_ACTIVE_PANE_EMBED:
    "Crear nuevo bosquejo - EN LA VENTANA ACTIVA ACTUAL - e incrustar en el documento activo",
  NEW_IN_POPOUT_WINDOW_EMBED: "Crear nuevo bosquejo - EN UNA VENTANA EMERGENTE - e incrustar en el documento activo",
  TOGGLE_LOCK: "Alternar Elemento de Texto entre edición RAW y VISTA PREVIA",
  DELETE_FILE: "Eliminar imagen o archivo Markdown seleccionado de la Bóveda de Obsidian",
  COPY_ELEMENT_LINK: "Copiar [[enlace]] para el/los elemento(s) seleccionado(s)",
  COPY_DRAWING_LINK: "Copiar ![[enlace incrustado]] de este bosquejo",
  INSERT_LINK_TO_ELEMENT:
    `Copiar [[enlace]] para el elemento seleccionado al portapapeles. ${labelCTRL()}+CLICK para copiar enlace 'group='. ${labelSHIFT()}+CLICK para copiar enlace 'area='.`,
  INSERT_LINK_TO_ELEMENT_GROUP:
    "Copiar 'group=' ![[enlace]] para el elemento seleccionado al portapapeles.",
  INSERT_LINK_TO_ELEMENT_AREA:
    "Copiar 'area=' ![[enlace]] para el elemento seleccionado al portapapeles.",
  INSERT_LINK_TO_ELEMENT_FRAME:
    "Copiar 'frame=' ![[enlace]] para el elemento seleccionado al portapapeles.",
  INSERT_LINK_TO_ELEMENT_FRAME_CLIPPED:
    "Copiar 'clippedframe=' ![[enlace]] para el elemento seleccionado al portapapeles.",
  INSERT_LINK_TO_ELEMENT_NORMAL:
    "Copiar [[enlace]] para el elemento seleccionado al portapapeles.",
  INSERT_LINK_TO_ELEMENT_ERROR: "Selecciona un solo elemento en la escena",
  INSERT_LINK_TO_ELEMENT_READY: "El enlace está LISTO y disponible en el portapapeles",
  INSERT_LINK: "Insertar enlace al archivo",
  INSERT_COMMAND: "Insertar comando de Obsidian como enlace",
  INSERT_IMAGE: "Insertar imagen o bosquejo de Excalidraw desde tu bóveda",
  IMPORT_SVG: "Importar un archivo SVG como trazos de Excalidraw (soporte SVG limitado, TEXTO no es compatible actualmente)",
  IMPORT_SVG_CONTEXTMENU: "Convertir SVG a trazos - con limitaciones",
  INSERT_MD: "Insertar archivo Markdown desde la bóveda",
  INSERT_PDF: "Insertar archivo PDF desde la bóveda",
  INSERT_LAST_ACTIVE_PDF_PAGE_AS_IMAGE: "Insertar última página PDF activa como imagen",
  UNIVERSAL_ADD_FILE: "Insertar CUALQUIER archivo",
  INSERT_CARD: "Agregar tarjeta_de_reverso de nota",
  CONVERT_CARD_TO_FILE: "Mover tarjeta_de_reverso de nota a Archivo",
  ERROR_TRY_AGAIN: "Por favor, inténtalo de nuevo.",
  PASTE_CODEBLOCK: "Pegar un bloque de código",
  INSERT_LATEX:
    `Insertar fórmula LaTeX (ej. \\binom{n}{k} = \\frac{n!}{k!(n-k)!}).`,
  ENTER_LATEX: "Ingresa una expresión LaTeX válida",
  READ_RELEASE_NOTES: "Leer las notas de la última versión",
  RUN_OCR: "OCR de bosquejo completo: Obtener texto de dibujos a mano alzada + imágenes al portapapeles y propiedades de documento",
  RERUN_OCR: "Reejecutar OCR de bosquejo completo: Obtener texto de dibujos a mano alzada + imágenes al portapapeles y propiedades de documento",
  RUN_OCR_ELEMENTS: "OCR de elementos seleccionados: Obtener texto de dibujos a mano alzada + imágenes al portapapeles",
  TRAY_MODE: "Alternar modo_de_bandeja panel_de_propiedades",
  SEARCH: "Buscar texto en el bosquejo",
  CROP_PAGE: "Recortar y enmascarar página seleccionada",
  CROP_IMAGE: "Recortar y enmascarar imagen",
  ANNOTATE_IMAGE : "Anotar imagen en Excalidraw",
  INSERT_ACTIVE_PDF_PAGE_AS_IMAGE: "Insertar página PDF activa como imagen",
  RESET_IMG_TO_100: "Establecer tamaño del elemento de imagen seleccionada al 100% del original",
  RESET_IMG_ASPECT_RATIO: "Restablecer relación de aspecto del elemento de imagen seleccionada",
  TEMPORARY_DISABLE_AUTOSAVE: "Desactivar autoguardado hasta el próximo inicio de Obsidian (solo haz esto si sabes lo que estás haciendo)",
  TEMPORARY_ENABLE_AUTOSAVE: "Activar autoguardado",
  FONTS_LOADED: "Excalidraw: Fuentes CJK cargadas",
  FONTS_LOAD_ERROR: "Excalidraw: No se pudieron encontrar las fuentes CJK en la carpeta assets\n",

  //Prompt.ts
  SELECT_LINK_TO_OPEN: "Selecciona un enlace para abrir",

  //ExcalidrawView.ts
  ERROR_CANT_READ_FILEPATH: "Error, no se puede leer la ruta del archivo. Insertando el archivo en su lugar",
  NO_SEARCH_RESULT: "No se encontró ningún elemento coincidente en el bosquejo",
  FORCE_SAVE_ABORTED: "Guardado forzado abortado porque ya se está guardando",
  LINKLIST_SECOND_ORDER_LINK: "Enlace de Segundo Orden",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT_TITLE: "Personalizar el enlace del archivo incrustado",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT: "¡No agregues [[corchetes]] alrededor del nombre de archivo!<br>" +
    "Para imágenes de páginas_Markdown, sigue este formato al editar tu enlace: <mark>nombre-archivo#^referencia-bloque|ANCHOxALTURAMAX</mark><br>" +
    "Puedes anclar imágenes de Excalidraw al 100% de su tamaño agregando <code>|100%</code> al final del enlace.<br>" +
    "Puedes cambiar la página del PDF cambiando <code>#page=1</code> a <code>#page=2</code>, etc.<br>" +
    "Los valores de recorte de rectángulo de PDF son: <code>left, bottom, right, top</code>. Ej.: <code>#rect=0,0,500,500</code><br>",
  FRAME_CLIPPING_ENABLED: "Renderizado de marcos: Habilitado",
  FRAME_CLIPPING_DISABLED: "Renderizado de marcos: Deshabilitado",
  ARROW_BINDING_INVERSE_MODE: "Modo Invertido: La vinculación de flechas predeterminada está ahora deshabilitada. Usa CTRL/CMD para habilitar temporalmente la vinculación cuando sea necesario.",
  ARROW_BINDING_NORMAL_MODE: "Modo Normal: La vinculación de flechas está ahora habilitada. Usa CTRL/CMD para deshabilitar temporalmente la vinculación cuando sea necesario.",
  EXPORT_FILENAME_PROMPT: "Por favor, ingresa el nombre de archivo",
  EXPORT_FILENAME_PROMPT_PLACEHOLDER: "nombre de archivo, dejar en blanco para cancelar la acción",
  WARNING_SERIOUS_ERROR: "ADVERTENCIA: ¡Excalidraw encontró un problema desconocido!\n\n" +
    "Existe el riesgo de que tus cambios más recientes no se puedan guardar.\n\n" +
    "Para estar seguro...\n" +
    "1) Por favor, selecciona tu bosquejo usando CTRL/CMD+A y haz una copia con CTRL/CMD+C.\n" +
    "2) Luego, crea un bosquejo vacío en un nuevo panel haciendo CTRL/CMD+clic en el botón de la barra de Excalidraw,\n" +
    "3) y pega tu trabajo en el nuevo documento con CTRL/CMD+V.",
  ARIA_LABEL_TRAY_MODE: "El modo bandeja ofrece un lienzo alternativo y más espacioso",
  MASK_FILE_NOTICE: "Este es un archivo de máscara. Se usa para recortar y enmascarar partes de la imagen. Mantén presionado el aviso para abrir el video de ayuda.",
  INSTALL_SCRIPT_BUTTON: "Instalar o actualizar scripts de Excalidraw",
  OPEN_AS_MD: "Abrir como Markdown",
  EXPORT_IMAGE: `Exportar imagen`,
  OPEN_LINK: "Abrir texto seleccionado como enlace\n(SHIFT+CLICK para abrir en un nuevo panel)",
  EXPORT_EXCALIDRAW: "Exportar a un archivo .Excalidraw",
  LINK_BUTTON_CLICK_NO_TEXT:
    "Selecciona un elemento que contenga un enlace interno o externo.\n",
  LINEAR_ELEMENT_LINK_CLICK_ERROR:
    "Los enlaces de elementos de flecha y línea no se pueden navegar haciendo " + labelCTRL() + " + CLICK en el elemento porque eso también activa el editor de línea.\n" +
    "Usa el menú contextual del click derecho para abrir el enlace, o haz clic en el indicador de enlace en la esquina superior derecha del elemento.\n",
  FILENAME_INVALID_CHARS:
    'El nombre de archivo no puede contener ninguno de los siguientes caracteres: * " \\ < > : | ? #',
  FORCE_SAVE:
    "Guardar (también actualizará las transclusiones)",
  RAW: "Cambiar a modo VISTA PREVIA (solo afecta elementos de texto con enlaces o transclusiones)",
  PARSED:
    "Cambiar a modo BRUTO(RAW) (solo afecta elementos de texto con enlaces o transclusiones)",
  NOFILE: "Excalidraw (sin archivo)",
  COMPATIBILITY_MODE:
    "Archivo *.excalidraw abierto en modo de compatibilidad. Convierte al nuevo formato para la funcionalidad completa del complemento.",
  CONVERT_FILE: "Convertir a nuevo formato",
  BACKUP_AVAILABLE: "Encontramos un error al cargar tu bosquejo. Esto pudo haber ocurrido si Obsidian se cerró inesperadamente durante una operación de guardado. Por ejemplo, si cerraste accidentalmente Obsidian en tu dispositivo móvil mientras guardabas.<br><br><b>BUENAS NOTICIAS:</b> Afortunadamente, hay una copia de seguridad local disponible. Sin embargo, ten en cuenta que si modificaste este bosquejo por última vez en un dispositivo diferente (ej. tablet) y ahora estás en tu computadora de escritorio, es probable que ese otro dispositivo tenga una copia de seguridad más reciente.<br><br>Recomiendo intentar abrir el bosquejo en tu otro dispositivo primero y restaurar la copia de seguridad desde su almacenamiento local.<br><br>¿Te gustaría cargar la copia de seguridad?",
  BACKUP_RESTORED: "Copia de seguridad restaurada",
  BACKUP_SAVE_AS_FILE: "Este bosquejo está vacío. Hay una copia de seguridad no vacía disponible. ¿Te gustaría restaurarla como un nuevo archivo y abrirla en una nueva pestaña?",
  BACKUP_SAVE: "Restaurar",
  BACKUP_DELETE: "Eliminar copia de seguridad",
  BACKUP_CANCEL: "Cancelar",
  CACHE_NOT_READY: "Disculpa las molestias, pero ocurrió un error al cargar tu archivo.<br><br><mark>Tener un poco de paciencia puede ahorrarte mucho tiempo...</mark><br><br>El complemento tiene una caché de respaldo, pero parece que acabas de iniciar Obsidian. La inicialización de la caché de respaldo puede tomar algún tiempo, generalmente hasta un minuto o más dependiendo del rendimiento de tu dispositivo. Recibirás una notificación en la esquina superior derecha cuando la inicialización de la caché esté completa.<br><br>Por favor, presiona OK para intentar cargar el archivo nuevamente y verificar si la caché ha terminado de inicializarse. Si ves un archivo completamente vacío detrás de este mensaje, te recomiendo esperar hasta que la caché de respaldo esté lista antes de continuar. Alternativamente, puedes elegir Cancelar para corregir tu archivo manualmente.<br>",
  OBSIDIAN_TOOLS_PANEL: "Panel de herramientas de Obsidian",
  ERROR_SAVING_IMAGE: "Ocurrió un error desconocido al obtener la imagen. Podría ser que por alguna razón la imagen no esté disponible o rechazó la solicitud de descarga de Obsidian.",
  WARNING_PASTING_ELEMENT_AS_TEXT: "NO SE PERMITE PEGAR ELEMENTOS DE EXCALIDRAW COMO ELEMENTO DE TEXTO",
  USE_INSERT_FILE_MODAL: "Usa 'Insertar CUALQUIER archivo' para incrustar una nota Markdown",
  RECURSIVE_INSERT_ERROR: "No puedes insertar recursivamente parte de una imagen en la misma imagen, ya que crearía un bucle infinito",
  CONVERT_TO_MARKDOWN: "Convertir a archivo...",
  SELECT_TEXTELEMENT_ONLY: "Seleccionar solo elemento de texto (no contenedor)",
  REMOVE_LINK: "Eliminar enlace del elemento de texto",
  LASER_ON: "Activar puntero láser",
  LASER_OFF: "Desactivar puntero láser",
  WELCOME_RANK_NEXT: "¡más bosquejos hasta el siguiente rango!",
  WELCOME_RANK_LEGENDARY: "Estás en la cima. ¡Sigue siendo legendario!",
  WELCOME_COMMAND_PALETTE: 'Escribe "Excalidraw" en la Paleta de Comandos',
  WELCOME_OBSIDIAN_MENU: "Explora el Menú de Obsidian en la esquina superior derecha",
  WELCOME_SCRIPT_LIBRARY: "Visita la Librería de Scripts",
  WELCOME_HELP_MENU: "Encuentra ayuda en el menú_de_hamburguesa",
  WELCOME_YOUTUBE_ARIA: "Canal de YouTube de PKM Visual",
  WELCOME_YOUTUBE_LINK: "Echa un vistazo al canal de YouTube de PKM Visual.",
  WELCOME_DISCORD_ARIA: "Únete al servidor de Discord",
  WELCOME_DISCORD_LINK: "Únete al servidor de Discord",
  WELCOME_TWITTER_ARIA: "Sígueme en Twitter",
  WELCOME_TWITTER_LINK: "Sígueme en Twitter",
  WELCOME_LEARN_ARIA: "Aprende PKM Visual",
  WELCOME_LEARN_LINK: "Inscríbete en el Taller de Pensamiento Visual",
  WELCOME_DONATE_ARIA: "Dona para apoyar Excalidraw-Obsidian",
  WELCOME_DONATE_LINK: 'Di "Gracias" y apoya el complemento.',
  SAVE_IS_TAKING_LONG: "Guardar tu archivo anterior está tomando mucho tiempo. Por favor espera...",
  SAVE_IS_TAKING_VERY_LONG: "Para un mejor rendimiento, considera dividir bosquejos grandes en varios archivos más pequeños.",

  //settings.ts
  LINKS_BUGS_ARIA: "Reporta errores y solicita nuevas funciones en la página de GitHub del complemento",
  LINKS_BUGS: "Reportar Errores",
  LINKS_YT_ARIA: "Visita mi canal de YouTube para aprender sobre Pensamiento Visual y Excalidraw",
  LINKS_YT: "Aprende en YouTube",
  LINKS_DISCORD_ARIA: "Únete al servidor de Discord del Taller de Pensamiento Visual",
  LINKS_DISCORD: "Únete a la Comunidad",
  LINKS_TWITTER: "Sígueme",
  LINKS_VTW_ARIA: "Aprende sobre PKM Visual, Excalidraw, Obsidian, ExcaliBrain y más",
  LINKS_VTW: "Únete a un Taller",
  LINKS_BOOK_ARIA: "Lee Sketch Your Mind, mi libro sobre Pensamiento Visual",
  LINKS_BOOK: "Lee el Libro",

  SETTINGS_COPIED_TO_CLIPBOARD: "Markdown listo en el portapapeles",
  SETTINGS_COPY_TO_CLIPBOARD: "Copiar como Texto",
  SETTINGS_COPY_TO_CLIPBOARD_ARIA: "Copia todo el diálogo de configuración al portapapeles como Markdown. Ideal para usar con herramientas como ChatGPT para buscar y entender la configuración.",

  RELEASE_NOTES_NAME: "Mostrar Notas de la Versión después de actualizar",
  RELEASE_NOTES_DESC:
    "<b><u>Activar:</u></b> Muestra las notas de la versión cada vez que actualices Excalidraw a una versión más reciente.<br>" +
    "<b><u>Desactivar:</u></b> Modo silencioso. Aún puedes leer las notas de la versión en <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases'>GitHub</a>.",
  NEWVERSION_NOTIFICATION_NAME: "Notificación de Actualización del Complemento",
  NEWVERSION_NOTIFICATION_DESC:
      "<b><u>Activar:</u></b> Muestra una notificación cuando hay una nueva versión del complemento disponible.<br>" +
      "<b><u>Desactivar:</u></b> Modo silencioso. Necesitarás verificar las actualizaciones del complemento en Complementos Comunitarios.",
  
  BASIC_HEAD: "Básico",
  BASIC_DESC: `En la configuración "Básica", puedes configurar opciones como mostrar las notas de la versión después de las actualizaciones, recibir notificaciones de actualización del complemento, establecer la ubicación predeterminada para nuevos bosquejos, especificar la carpeta de Excalidraw para incrustar bosquejos en documentos activos, definir un archivo de plantilla de Excalidraw, y designar una carpeta de scripts de Excalidraw Automate para gestionar scripts de automatización.`,
  FOLDER_NAME: "Carpeta de Excalidraw (¡Sensible a MAYÚSCULAS/minúsculas!)",
  FOLDER_DESC:
    "Ubicación predeterminada para nuevos bosquejos. Si está vacío, los bosquejos se crearán en la raíz de la Bóveda.",
  CROP_SUFFIX_NAME: "Sufijo para archivo recortado",
  CROP_SUFFIX_DESC:
    "La última parte del nombre del archivo para nuevos bosquejos creados al recortar una imagen. " +
    "Deja el campo vacío si no necesitas un sufijo.",
  CROP_PREFIX_NAME: "Prefijo para archivo recortado",
  CROP_PREFIX_DESC:
    "La primera parte del nombre del archivo para nuevos bosquejos creados al recortar una imagen. " +
    "Deja el campo vacío si no necesitas un prefijo.",  
  ANNOTATE_SUFFIX_NAME: "Sufijo para archivo de anotación",
  ANNOTATE_SUFFIX_DESC:
    "La última parte del nombre del archivo para nuevos bosquejos creados al anotar una imagen. " +
    "Deja el campo vacío si no necesitas un sufijo.",
  ANNOTATE_PREFIX_NAME: "Prefijo para archivo de anotación",
  ANNOTATE_PREFIX_DESC:
    "La primera parte del nombre del archivo para nuevos bosquejos creados al anotar una imagen. " +
    "Deja el campo vacío si no necesitas un prefijo.",
  ANNOTATE_PRESERVE_SIZE_NAME: "Preservar tamaño de imagen al anotar",
  ANNOTATE_PRESERVE_SIZE_DESC:
    "Al anotar una imagen en Markdown, el enlace de la imagen de reemplazo incluirá el ancho de la imagen original.",
  CROP_FOLDER_NAME: "Carpeta de archivos recortados (¡Sensible a MAYÚSCULAS/minúsculas!)",
  CROP_FOLDER_DESC:
    "Ubicación predeterminada para nuevos bosquejos creados al recortar una imagen. Si el campo está vacío, los bosquejos se crearán siguiendo la configuración de adjuntos de la Bóveda.",
  ANNOTATE_FOLDER_NAME: "Carpeta de archivos de anotación de imagen (¡Sensible a MAYÚSCULAS/minúsculas!)",
  ANNOTATE_FOLDER_DESC:
    "Ubicación predeterminada para nuevos bosquejos creados al anotar una imagen. Si el campo está vacío, los bosquejos se crearán siguiendo la configuración de adjuntos de la Bóveda.",
  FOLDER_EMBED_NAME:
    "Usar carpeta de Excalidraw al incrustar un bosquejo en el documento activo",
  FOLDER_EMBED_DESC:
    "Define en qué carpeta se colocará el bosquejo recién insertado " +
    "al usar la acción de la paleta de comandos: 'Crear un nuevo bosquejo e incrustar en el documento activo'.<br>" +
    "<b><u>Activar:</u></b> Usar carpeta de Excalidraw<br><b><u>Desactivar:</u></b> Usar la carpeta de adjuntos definida en la configuración de Obsidian.",
  TEMPLATE_NAME: "Archivo o carpeta de plantillas de Excalidraw (¡Sensible a MAYÚSCULAS/minúsculas!)",
  TEMPLATE_DESC:
    "Ruta de archivo o carpeta completa a la plantilla de Excalidraw.<br>" +
    "<b>Archivo de Plantilla:</b>Ej.: Si tu plantilla está en la carpeta predeterminada de Excalidraw y su nombre es " +
    "Plantilla.md, la configuración sería: Excalidraw/Plantilla.md (o simplemente Excalidraw/Plantilla - puedes omitir la extensión de archivo .md). " +
    "Si estás usando Excalidraw en modo de compatibilidad, entonces tu plantilla también debe ser un archivo Excalidraw heredado " +
    "como Excalidraw/Plantilla.excalidraw. <br><b>Carpeta de Plantillas:</b> También puedes establecer una carpeta como tu plantilla. " +
    "En este caso, se te pedirá qué plantilla usar al crear un nuevo bosquejo.<br>" +
    "<b>Consejo:</b>  Si estás usando el complemento Obsidian Templater, puedes añadir código Templater a tus diferentes plantillas de Excalidraw " +
    "para automatizar la configuración de tus bosquejos.",
  SCRIPT_FOLDER_NAME: "Carpeta de scripts para Excalidraw Automate (¡Sensible a MAYÚSCULAS/minúsculas!)",
  SCRIPT_FOLDER_DESC:
    "Los archivos que coloques en esta carpeta se tratarán como scripts de Excalidraw Automate. " +
    "Puedes acceder a tus scripts desde Excalidraw a través de la Paleta de Comandos de Obsidian. Asigna " +
    "atajos de teclado a tus scripts favoritos al igual que a cualquier otro comando de Obsidian. " +
    "La carpeta no puede ser la carpeta raíz de tu Bóveda. ",
  AI_HEAD: "Configuración de IA - Experimental",
  AI_DESC: `En la configuración de "IA", puedes configurar opciones para usar la API GPT de OpenAI. ` +
    `Aunque la API de OpenAI está en fase beta, su uso es estrictamente limitado; por lo tanto, requerimos que uses tu propia API KEY (clave de API). ` +
    `Puedes crear una cuenta de OpenAI, agregar un pequeño crédito (mínimo 5 USD) y generar tu propia API KEY (clave de API) ` +
    `Una vez que la API KEY (clave de API) esté configurada, podrás usar las herramientas de IA en Excalidraw.`,
  AI_ENABLED_NAME: "Habilitar funcionalidades de IA",
  AI_ENABLED_DESC: "Necesitas reabrir Excalidraw para que los cambios surtan efecto.",
  AI_OPENAI_TOKEN_NAME: "OpenAI API key (Clave de API de OpenAI)",
  AI_OPENAI_TOKEN_DESC:
    "Puedes obtener tu API KEY (clave de API) de OpenAI desde tu <a href='https://platform.openai.com/api-keys'></a>.",
  AI_OPENAI_TOKEN_PLACEHOLDER: "Ingresa tu API Key (clave de API) de OpenAI aquí",
  AI_OPENAI_DEFAULT_MODEL_NAME: "Modelo de IA predeterminado",
  AI_OPENAI_DEFAULT_MODEL_DESC:
    "El modelo de IA predeterminado para usar al generar texto. Este es un campo de texto libre, así que puedes ingresar cualquier nombre de modelo de OpenAI válido. " +
    "Encuentra más información sobre los modelos disponibles en el sitio web de OpenAI: <a href='https://platform.openai.com/docs/models'></a>.",
  AI_OPENAI_DEFAULT_MODEL_PLACEHOLDER: "Ingresa aquí tu modelo de IA predeterminado. Ej.: gpt-3.5-turbo-1106",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_NAME: "Modelo de IA predeterminado para generación de imágenes",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_DESC:
    "El modelo de IA predeterminado para usar al generar imágenes. La edición y variaciones de imágenes solo son compatibles con Dall-E 2 en este momento por parte de OpenAI, " +
    "por esta razón, Dall-E 2 se usará automáticamente en tales casos, independientemente de esta configuración.<br>" +
    "Este es un campo de texto libre, así que puedes ingresar cualquier nombre de modelo de OpenAI válido. " +
    "Encuentra más información sobre los modelos disponibles en el sitio web de OpenAI: <a href='https://platform.openai.com/docs/models'></a>.",
  AI_OPENAI_DEFAULT_IMAGE_MODEL_PLACEHOLDER: "Ingresa aquí tu modelo de IA predeterminado para generación de imágenes. Ej.: Dall-E 3",
  AI_OPENAI_DEFAULT_VISION_MODEL_NAME: "Modelo de visión de IA predeterminado",
  AI_OPENAI_DEFAULT_VISION_MODEL_DESC:
    "El modelo de visión de IA predeterminado para usar al generar texto a partir de imágenes. Este es un campo de texto libre, así que puedes ingresar cualquier nombre de modelo de OpenAI válido. " +
    "Find out more about the available models on the <a href='https://platform.openai.com/docs/models'>OpenAI website</a>.",
  AI_OPENAI_DEFAULT_API_URL_NAME: "URL de la API de OpenAI",
  AI_OPENAI_DEFAULT_API_URL_DESC:
    "La URL predeterminada de la API de OpenAI. Este es un campo de texto libre, así que puedes ingresar cualquier URL compatible con la API de OpenAI válida. " +
    "Excalidraw usará esta URL al enviar solicitudes a la API de OpenAI. No realizo manejo de errores en este campo, así que asegúrate de ingresar una URL válida y solo cámbiala si sabes lo que estás haciendo. ",
  AI_OPENAI_DEFAULT_IMAGE_API_URL_NAME: "URL de la API de Generación de Imágenes de OpenAI",
  AI_OPENAI_DEFAULT_VISION_MODEL_PLACEHOLDER: "Ingresa aquí tu modelo de visión de IA predeterminado. Ej.: gpt-4o",
  SAVING_HEAD: "Guardar",
  SAVING_DESC: "En la sección 'Guardar' de la Configuración de Excalidraw, puedes configurar cómo se guardan tus bosquejos. Esto incluye opciones para comprimir el JSON de Excalidraw en Markdown, establecer intervalos de autoguardado para escritorio y móvil, definir formatos de nombre de archivo y elegir si usar la extensión de archivo .excalidraw.md o .md. ",
  COMPRESS_NAME: "Comprimir JSON de Excalidraw en Markdown",
  COMPRESS_DESC:
    "Al habilitar esta función, Excalidraw almacenará el JSON del bosquejo en un formato comprimido Base64 " +
    "utilizando el algoritmo <a href='https://pieroxy.net/blog/pages/lz-string/index.html'>LZ-String</a>. " +
    "Esto reducirá la probabilidad de que el JSON de Excalidraw sature tus resultados de búsqueda en Obsidian. " +
    "Como efecto secundario, también reducirá el tamaño de los archivos de los bosquejos de Excalidraw. " +
    "Cuando cambias un bosquejo de Excalidraw a la vista de Markdown, usando el menú de opciones en Excalidraw, el archivo " +
    "se guardará sin compresión, para que puedas leer y editar la cadena JSON. El bosquejo se comprimirá de nuevo " +
    "una vez que vuelvas a la vista de Excalidraw. " +
    "La configuración solo tiene efecto 'en adelante', es decir, los bosquejos existentes no se verán afectados por la configuración " +
    "hasta que los abras y los guardes.<br><b><u>Activado:</u></b> Comprime el JSON del bosquejo<br><b><u>Desactivado:</u></b> Deja el JSON del bosquejo sin comprimir ",
  DECOMPRESS_FOR_MD_NAME: "Descomprimir JSON de Excalidraw en la vista de Markdown",
  DECOMPRESS_FOR_MD_DESC:
    "Al habilitar esta función, Excalidraw descomprimirá automáticamente el JSON del bosquejo cuando cambies a la vista de Markdown. " +
    "Esto te permitirá leer y editar fácilmente la cadena JSON. El bosquejo se comprimirá de nuevo " +
    "una vez que vuelvas a la vista de Excalidraw y guardes el bosquejo (CTRL+S).<br>" +
    "Recomiendo desactivar esta función, ya que resultará en tamaños de archivo más pequeños y evitará resultados innecesarios en la búsqueda de Obsidian. " +
    "Siempre puedes usar el comando 'Excalidraw: Descomprimir archivo Excalidraw actual' desde la paleta de comandos "+
    "para descomprimir manualmente el JSON del bosquejo cuando necesites leerlo o editarlo.",
  AUTOSAVE_INTERVAL_DESKTOP_NAME: "Intervalo para autoguardado en Escritorio",
  AUTOSAVE_INTERVAL_DESKTOP_DESC:
    "Es el intervalo de tiempo entre guardados. El autoguardado se omitirá si no hay cambios en el bosquejo. " +
    "Excalidraw también guardará el archivo al cerrar una pestaña del espacio de trabajo o al navegar dentro de Obsidian, pero lejos de la pestaña activa de Excalidraw (es decir, hacer clic en la barra de Obsidian o revisar los enlaces inversos, etc.). " +
    "Excalidraw no podrá guardar tu trabajo al cerrar Obsidian directamente, ya sea terminando el proceso de Obsidian o haciendo clic para cerrar Obsidian por completo.",
  AUTOSAVE_INTERVAL_MOBILE_NAME: "Intervalo para autoguardado en Móvil",
  AUTOSAVE_INTERVAL_MOBILE_DESC:
    "Recomiendo un intervalo más frecuente para móviles. " +
    "Excalidraw también guardará el archivo al cerrar una pestaña del espacio de trabajo o al navegar dentro de Obsidian, pero lejos de la pestaña activa de Excalidraw (es decir, tocar la barra de Obsidian o revisar los enlaces inversos, etc.). " +
    "Excalidraw no podrá guardar tu trabajo al cerrar Obsidian directamente (es decir, al deslizar la aplicación para cerrarla). También ten en cuenta que cuando cambias de aplicación en un dispositivo móvil, a veces Android e iOS cierran " +
    "Obsidian en segundo plano para ahorrar recursos del sistema. En tal caso, Excalidraw no podrá guardar los últimos cambios.",
FILENAME_HEAD: "Nombre de archivo",
  FILENAME_DESC:
    "<p>Haz click en este enlace para la <a href='https://momentjs.com/docs/#/displaying/format/'>" +
    "referencia de formato de fecha y hora</a>.</p>",
  FILENAME_SAMPLE: "El nombre de archivo para un nuevo bosquejo es: ",
  FILENAME_EMBED_SAMPLE: "El nombre de archivo para un nuevo bosquejo incrustado es: ",
  FILENAME_PREFIX_NAME: "Prefijo del nombre de archivo",
  FILENAME_PREFIX_DESC: "La primera parte del nombre del archivo. ",
  FILENAME_PREFIX_EMBED_NAME:
    "Prefijo del nombre de archivo al incrustar un nuevo bosquejo en una nota Markdown",
  FILENAME_PREFIX_EMBED_DESC:
    "Debería el nombre del nuevo bosquejo insertado comenzar con el nombre de la nota Markdown activa " +
    "al usar la acción de la paleta de comandos: <code>Crear un nuevo bosquejo e incrustar en el documento activo</code>?<br>" +
    "<b><u>Activado:</u></b> Sí, el nombre del nuevo bosquejo debería comenzar con el nombre del archivo del documento activo.<br><b><u>Desactivado:</u></b> No, el nombre del nuevo bosquejo no debería incluir el nombre del archivo del documento activo.",
  FILENAME_POSTFIX_NAME:
    "Texto personalizado después del nombre de la nota Markdown al incrustar",
  FILENAME_POSTFIX_DESC:
    "Afecta el nombre del archivo solo al incrustarlo en un documento Markdown. Este texto se insertará después del nombre de la nota, pero antes de la fecha.",
  FILENAME_DATE_NAME: "Fecha en el nombre de archivo",
  FILENAME_DATE_DESC:
    "La última parte del nombre del archivo. Deja en blanco si no quieres incluir una fecha.",
  FILENAME_EXCALIDRAW_EXTENSION_NAME: ".excalidraw.md o .md",
  FILENAME_EXCALIDRAW_EXTENSION_DESC:
    "Esta configuración no aplica si usas Excalidraw en modo de compatibilidad, " +
    "es decir, si no usas archivos Markdown de Excalidraw. <br><b><u>Activado:</u></b> el nombre de archivo termina en .excalidraw.md<br><b><u>Desactivado:</u></b> el nombre de archivo termina en .md",
  DISPLAY_HEAD: "Apariencia y Comportamiento de Excalidraw",
  DISPLAY_DESC: "En la sección 'Apariencia y Comportamiento' de la Configuración de Excalidraw, puedes ajustar cómo se ve y se comporta Excalidraw. Esto incluye opciones para estilos dinámicos, modo para zurdos, coincidencia de temas de Excalidraw y Obsidian, modos predeterminados y más.",
  OVERRIDE_OBSIDIAN_FONT_SIZE_NAME: "Limitar tamaño de fuente de Obsidian al texto del editor",
  OVERRIDE_OBSIDIAN_FONT_SIZE_DESC:
    "La configuración de tamaño de fuente personalizada de Obsidian afecta toda la interfaz, incluyendo Excalidraw y los temas que dependen del tamaño de fuente predeterminado. " +
    "Habilitar esta opción restringe los cambios de tamaño de fuente al texto del editor, lo que mejorará el aspecto de Excalidraw. " +
    "Si partes de la interfaz de usuario se ven incorrectas después de habilitarla, intenta desactivar esta configuración.",  
  DYNAMICSTYLE_NAME: "Estilo dinámico",
  DYNAMICSTYLE_DESC:
    "Cambia los colores de la interfaz de usuario de Excalidraw para que coincidan con el color del lienzo",
  LEFTHANDED_MODE_NAME: "Modo para zurdos",
  LEFTHANDED_MODE_DESC:
    "Actualmente solo tiene efecto en el modo de bandeja. Si está activado, la bandeja estará en el lado derecho." +
    "<br><b><u>Activado:</u></b> Modo para zurdos. <br><b><u>Desactivado:</u></b> Modo para diestros.",
  IFRAME_MATCH_THEME_NAME: "Incrustaciones de Markdown para que coincidan con el tema de Excalidraw",
  IFRAME_MATCH_THEME_DESC:
    "<b><u>Activado:</u></b> Establece esto en verdadero si, por ejemplo, estás usando Obsidian en modo oscuro pero usas Excalidraw con un fondo claro. " +
    "Con esta configuración, el documento Markdown incrustado de Obsidian coincidirá con el tema de Excalidraw (es decir, colores claros si Excalidraw está en modo claro).<br>" +
    "<b><u>Desactivado:</u></b> Establece esto en falso si quieres que el documento Markdown incrustado de Obsidian coincida con el tema de Obsidian (es decir, colores oscuros si Obsidian está en modo oscuro).",    
  MATCH_THEME_NAME: "Nuevo bosquejo para que coincida con el tema de Obsidian",
  MATCH_THEME_DESC:
    "Si el tema es oscuro, el nuevo bosquejo se creará en modo oscuro. Esto no aplica cuando usas una plantilla para nuevos bosquejos. " +
    "Tampoco afectará cuando abras un bosquejo existente. Esos seguirán el tema de la plantilla/bosquejo respectivamente." +
    "<br><b><u>Activado:</u></b> Sigue el Tema de Obsidian <br><b><u>Desactivado:</u></b> Sigue el el tema definido en tu plantilla",
  MATCH_THEME_ALWAYS_NAME: "Bosquejos existentes para que coincidan con el tema de Obsidian",
  MATCH_THEME_ALWAYS_DESC:
    "Si el tema es oscuro, los bosquejos se abrirán en modo oscuro. Si tu tema es claro, se abrirán en modo claro. " +
    "<br><b><u>Activado:</u></b> Coincide con el tema de Obsidian<br><b><u>Desactivado:</u></b> Se abre con el mismo tema que la última vez que se guardó",
  MATCH_THEME_TRIGGER_NAME: "Excalidraw para seguir cuando cambie el tema de Obsidian",
  MATCH_THEME_TRIGGER_DESC:
    "Si esta opción está habilitada, el panel de Excalidraw abierto cambiará a modo claro/oscuro cuando cambie el tema de Obsidian. " +
    "<br><b><u>Activado:</u></b> Sigue el cambio de tema <br><b><u>Desactivado:</u></b> Los bosquejos no se ven afectados por los cambios de tema de Obsidian",
  DEFAULT_OPEN_MODE_NAME: "Modo predeterminado al abrir Excalidraw",
  DEFAULT_OPEN_MODE_DESC:
    "Especifica el modo en que se abre Excalidraw: Normal, Zen o Vista. También puedes configurar este comportamiento a nivel de archivo " +
    "añadiendo la clave excalidraw-default-mode al frontmatter de tu documento con un valor de: normal, view o zen.",
  DEFAULT_PEN_MODE_NAME: "Modo lápiz",
  DEFAULT_PEN_MODE_DESC:
    "¿Debe habilitarse automáticamente el modo lápiz al abrir Excalidraw?",
  ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME: "Habilitar creación de texto con doble click",
  DISABLE_DOUBLE_TAP_ERASER_NAME: "Habilitar borrador con doble tap(toque) en modo lápiz",
  DISABLE_SINGLE_FINGER_PANNING_NAME: "Habilitar desplazamiento con un solo dedo en modo lápiz",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME: "Mostrar mira (+) en modo lápiz",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC:
    "Muestra una mira en modo lápiz al usar la herramienta de dibujo a mano alzada. <b><u>Activado:</u></b> MOSTRAR <b><u>Desactivado:</u></b> OCULTAR<br>"+
    "El efecto depende del dispositivo. La mira es típicamente visible en tabletas de dibujo, MS Surface, pero no en iOS.",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME: "Renderizar archivo de Excalidraw como imagen en la vista previa al pasar el mouse...",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC:
    "...incluso si el archivo tiene la clave frontmatter <b>excalidraw-open-md: true</b>.<br>" +
    "Cuando esta configuración está desactivada y el archivo está configurado para abrirse en Markdown por defecto, " +
    "la vista previa al pasar el mouse mostrará el lado Markdown del documento.",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME: "Renderizar como imagen en el modo de lectura Markdown de un archivo de Excalidraw",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC:
    "Cuando estás en modo de lectura Markdown (es decir, leyendo el reverso del bosquejo), ¿debe renderizarse el bosquejo de Excalidraw como una imagen? " +
    "Esta configuración no afectará la visualización del bosquejo cuando estés en modo Excalidraw, cuando incrustes el bosquejo en un documento Markdown o cuando se renderice la vista previa al pasar el mouse.<br><ul>" +
    "<li>Consulta otra configuración relacionada para la <a href='#"+TAG_PDFEXPORT+"'>Exportación a PDF</a> en 'Incrustación y Exportación' más abajo.</li></ul><br>" +
    "Debes cerrar el archivo activo de Excalidraw/Markdown y volver a abrirlo para que este cambio surta efecto.",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME: "Renderizar Excalidraw como Imagen en la Exportación a PDF de Obsidian",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC:
    "Esta configuración controla cómo se exportan los archivos de Excalidraw a PDF usando la función incorporada de Obsidian <b>Exportar a PDF</b>.<br>" +
    "<ul><li><b>Habilitado:</b> El PDF incluirá el bosquejo de Excalidraw como una imagen.</li>" +
    "<li><b>Desactivado:</b> El PDF incluirá el contenido Markdown como texto.</li></ul>" +
    "Nota: Esta configuración no afecta la función de exportación a PDF dentro del propio Excalidraw.<br>" +
    "Consulta la otra configuración relacionada para el  <a href='#"+TAG_MDREADINGMODE+"'>Modo de Lectura de Markdown</a> en 'Apariencia y Comportamiento' más arriba.<br>" +
    "⚠️ Debes cerrar y volver a abrir el archivo de Excalidraw/Markdown para que los cambios surtan efecto. ⚠️",
  HOTKEY_OVERRIDE_HEAD: "Anulaciones de atajos de teclado",
  HOTKEY_OVERRIDE_DESC: `Algunos de los atajos de teclado de Excalidraw, como <code>${labelCTRL()}+Enter</code> para editar texto o <code>${labelCTRL()}+K</code> para crear un enlace de elemento ` +
    "entran en conflicto con la configuración de atajos de teclado de Obsidian. Las combinaciones de atajos de teclado que agregues a continuación anularán la configuración de atajos de teclado de Obsidian mientras usas Excalidraw. Por lo tanto, " +
    `puedes agregar <code>${labelCTRL()}+G</code> si quieres que el comportamiento predeterminado sea Agrupar Objeto en Excalidraw en lugar de abrir la Vista de Gráfico.`,
  THEME_HEAD: "Tema y estilo",
  ZOOM_HEAD: "Zoom",
  DEFAULT_PINCHZOOM_NAME: "Permitir zoom con pellizco en modo lápiz",
  DEFAULT_PINCHZOOM_DESC:
    "El zoom con pellizco en modo lápiz, al usar la herramienta de dibujo a mano alzada, está deshabilitado por defecto para evitar zooms accidentales no deseados con la palma de la mano.<br>" +
    "<b><u>Activado:</u></b> Habilita el zoom con pellizco en modo lápiz <br><b><u>Desactivado:</u></b>Deshabilita el zoom con pellizco en modo lápiz",

  DEFAULT_WHEELZOOM_NAME: "Rueda del mouse para zoom por defecto",
  DEFAULT_WHEELZOOM_DESC:
    `<b><u>Activado:</u></b> Rueda del mouse para zoom; ${labelCTRL()} + rueda del mouse para desplazarse</br><b><u>Desactivado:</u></b>${labelCTRL()} + rueda del mouse para zoom; Rueda del mouse para desplazarse`,
    
  ZOOM_TO_FIT_NAME: "Zoom para ajustar al redimensionar la vista",
  ZOOM_TO_FIT_DESC: "Zoom para ajustar el bosquejo cuando se redimensiona el panel." +
    "<br><b><u>Activado:</u></b> Zoom para ajustar<br><b><u>Desactivado:</u></b> Auto-zoom deshabilitado",
  ZOOM_TO_FIT_ONOPEN_NAME: "Zoom para ajustar al abrir archivo",
  ZOOM_TO_FIT_ONOPEN_DESC: "Zoom para ajustar el bosquejo cuando se abre por primera vez." +
      "<br><b><u>Activado:</u></b> Zoom para ajustar<br><b><u>Desactivado:</u></b> Auto-zoom deshabilitado",  
  ZOOM_TO_FIT_MAX_LEVEL_NAME: "Nivel máximo de zoom para ajustar",
  ZOOM_TO_FIT_MAX_LEVEL_DESC:
    "Establece el nivel máximo al que el zoom para encajar agrandará el bosquejo. El mínimo es 0.5 (50%) y el máximo es 10 (1000%).",
  PEN_HEAD: "Lápiz",
  GRID_HEAD: "Cuadrícula",
  GRID_DYNAMIC_COLOR_NAME: "Color de cuadrícula dinámica",
  GRID_DYNAMIC_COLOR_DESC:
    "<b><u>Activado:</u></b> Cambia el color de la cuadrícula para que coincida con el color del lienzo<br><b><u>Desactivado:</u></bUsar el color de abajo como color de la cuadrícula",
  GRID_COLOR_NAME: "Color de la cuadrícula",
  GRID_OPACITY_NAME: "Opacidad de la cuadrícula",
  GRID_OPACITY_DESC: "La opacidad de la cuadrícula también controlará la opacidad del recuadro de vinculación al vincular una flecha a un elemento.<br>" +
    "Establece la opacidad de la cuadrícula. 0 es transparente, 100 es opaco.",
  GRID_DIRECTION_NAME: "Dirección de la cuadrícula",
  GRID_DIRECTION_DESC: "El primer interruptor muestra/oculta la cuadrícula horizontal, el segundo interruptor muestra/oculta la cuadrícula vertical.",
  GRID_HORIZONTAL: "Renderizar cuadrícula horizontal",
  GRID_VERTICAL: "Renderizar cuadrícula vertical",
  LASER_HEAD: "Puntero láser",
  LASER_COLOR: "Color del puntero láser",
  LASER_DECAY_TIME_NAME: "Tiempo de desvanecimiento del puntero láser",
  LASER_DECAY_TIME_DESC: "Tiempo de desvanecimiento del puntero láser en milisegundos. El valor predeterminado es 1000 (es decir, 1 segundo).",
  LASER_DECAY_LENGTH_NAME: "Longitud de desvanecimiento del puntero láser.",
  LASER_DECAY_LENGTH_DESC: "Longitud de desvanecimiento del puntero láser en puntos de línea. El valor predeterminado es 50.",
  LINKS_HEAD: "Enlaces, transclusión y pendientes (TODOs)",
  LINKS_HEAD_DESC: "En la sección 'Enlaces, transclusión y pendientes (TODOs)' de la Configuración de Excalidraw, puedes configurar cómo Excalidraw maneja los enlaces, las transclusiones y los elementos pendientes (TODO). Esto incluye opciones para abrir enlaces, gestionar paneles, mostrar enlaces con corchetes, personalizar prefijos de enlaces, manejar elementos pendientes (TODO) y más. ",
  LINKS_DESC:
    `${labelCTRL()}+CLICK on <code>[[Elementos de Texto]]</code> para abrirlos como enlaces. ` +
    "Si el texto seleccionado tiene más de un <code>[[enlace válido de Obsidian]]</code>, solo se abrirá el primero. " +
    "Si el texto comienza como un enlace web válido (es decir, <code>https://</code> o <code>http://</code>), entonces " +
    "el complemento lo abrirá en un navegador. " +
    "Cuando los archivos de Obsidian cambian, el <code>[[enlace]]</code> coincidente en tus bosquejos también cambiará. " +
    "Si no quieres que el texto cambie accidentalmente en tus bosquejos, usa <code>[[enlaces|con alias]]</code>.",
  DRAG_MODIFIER_NAME: "Teclas modificadoras para click de enlace y Arrastrar y Soltar(Drag&Drop)",
  DRAG_MODIFIER_DESC: "Comportamiento de la tecla modificadora al hacer click en enlaces y arrastrar y soltar elementos. " +
    "Excalidraw no validará tu configuración... presta atención para evitar configuraciones conflictivas. " +
    "Estas configuraciones son diferentes para Apple y no Apple. Si usas Obsidian en múltiples plataformas, deberás realizar las configuraciones por separado. "+
    "Los interruptores siguen el orden de " +
    (DEVICE.isIOS || DEVICE.isMacOS ? "SHIFT, CMD, OPT, CONTROL." : "SHIFT, CTRL, ALT, META (Tecla de Windows)."),
  LONG_PRESS_DESKTOP_NAME: "Mantener presionado para abrir en escritorio",
  LONG_PRESS_DESKTOP_DESC: "Retraso en milisegundos para mantener presionado y abrir un bosquejo de Excalidraw incrustado en un archivo Markdown. ",
  LONG_PRESS_MOBILE_NAME: "Mantener presionado para abrir en móvil",
  LONG_PRESS_MOBILE_DESC: "Retraso en milisegundos para mantener presionado y abrir un bosquejo de Excalidraw incrustado en un archivo Markdown. ",
  DOUBLE_CLICK_LINK_OPEN_VIEW_MODE: "Permitir doble click para abrir enlaces en modo vista",

  FOCUS_ON_EXISTING_TAB_NAME: "Enfocar en pestaña existente",
  FOCUS_ON_EXISTING_TAB_DESC: "Al abrir un enlace, Excalidraw se enfocará en la pestaña existente si el archivo ya está abierto. " +
    "Habilitar esta configuración anula 'Reutilizar Panel Adyacente' cuando el archivo ya está abierto, excepto para la acción de la paleta de comandos 'Abrir el reverso de la nota de la imagen de excalidraw seleccionada'.",
  SECOND_ORDER_LINKS_NAME: "Mostrar enlaces de segundo orden",
  SECOND_ORDER_LINKS_DESC: "Muestra enlaces al hacer clic en un enlace en Excalidraw. Los enlaces de segundo orden son enlaces inversos que apuntan al enlace en el que se hizo click. " +
    "Al usar iconos de imagen para conectar notas similares, los enlaces de segundo orden te permiten acceder a notas relacionadas en un solo clic en lugar de dos. " +
    "Consulta el siguiente <a href='https://youtube.com/shorts/O_1ls9c6wBY?feature=share'>Short de Youtube</a> para entender.",
  ADJACENT_PANE_NAME: "Reutilizar panel adyacente",
  ADJACENT_PANE_DESC:
    `Cuando usas ${labelCTRL()}+${labelALT()} y haces click en un enlace en Excalidraw, por defecto el complemento lo abrirá en un panel nuevo. ` +
    "Al activar esta opción, Excalidraw buscará primero un panel ya abierto e intentará abrir el enlace ahí. " +
    "Excalidraw buscará el panel adyacente basándose en tu historial de foco/navegación, es decir, el panel de trabajo que estaba activo antes de que activaras Excalidraw. " +
    "activated Excalidraw.",
  MAINWORKSPACE_PANE_NAME: "Abrir en el espacio de trabajo principal",
  MAINWORKSPACE_PANE_DESC:
    `Cuando usas ${labelCTRL()}+${labelALT()} y haces click en un enlace en Excalidraw, por defecto el plugin lo abrirá en un panel nuevo en la ventana activa. ` +
    "Al activar esta opción, Excalidraw abrirá el enlace en un panel nuevo o ya existente en el espacio de trabajo principal. ",  
  LINK_BRACKETS_NAME: "Mostrar <code>[[corchetes]]</code> alrededor de los enlaces",
  LINK_BRACKETS_DESC: `${
    "En el MODO VISTA PREVIA, al analizar elementos de texto, se colocarán corchetes alrededor de los enlaces. " +
    "Puedes anular esta configuración para un bosquejo específico agregando <code>"
  }${FRONTMATTER_KEYS["link-brackets"].name}: true/false</code> al frontmatter del archivo.`,
  LINK_PREFIX_NAME: "Link prefix",
  LINK_PREFIX_DESC: `${
    "En el MODO VISTA PREVIA, si el elemento de texto contiene un enlace, se precederá el texto con estos caracteres. " +
    "Puedes anular esta configuración para un bosquejo específico agregando <code>"
  }${FRONTMATTER_KEYS["link-prefix"].name}: "📍 "</code> al frontmatter del archivo.`,
  URL_PREFIX_NAME: "URL prefix",
  URL_PREFIX_DESC: `${
    "En el MODO VISTA PREVIA, si el elemento de texto contiene un enlace URL, se precederá el texto con estos caracteres. " +
    "Puedes anular esta configuración para un bosquejo específico agregando <code>"
  }${FRONTMATTER_KEYS["url-prefix"].name}: "🌐 "</code> al frontmatter del archivo.`,
  PARSE_TODO_NAME: "Analizar tareas pendientes",
  PARSE_TODO_DESC: "Convertir '- [ ] ' y '- [x] ' en casillas de verificación (checkbox) con y sin marca.",
  TODO_NAME: "Abrir ícono de tareas pendientes",
  TODO_DESC: "Ícono a usar para las tareas pendientes (sin completar).",
  DONE_NAME: "Ícono de tarea completada",
  DONE_DESC: "Ícono a usar para las tareas completadas.",
  HOVERPREVIEW_NAME: `Previsualización al pasar el mouse sin presionar la tecla ${labelCTRL()} `,
  HOVERPREVIEW_DESC:
    `<b><u>Activado::</u></b> En el <u>modo visualización</u> de Excalidraw, la previsualización de los enlaces wiki [[ejemplo]] se mostrará inmediatamente, sin necesidad de mantener presionada la tecla ${labelCTRL()} . ` +
    "En el <u>modo normal</u> de Excalidraw, , la previsualización se mostrará inmediatamente solo al pasar el mouse sobre el ícono de enlace azul en la esquina superior derecha del elemento.<br> " +
    `<b><u>Desactivado:</u></b> La previsualización solo se muestra si mantienes la tecla ${labelCTRL()} presionada mientras pasas el mouse sobre el enlace.`,
  LINKOPACITY_NAME: "Opacidad del ícono de enlace",
  LINKOPACITY_DESC:
    "Opacidad del ícono de enlace que aparece en la esquina superior derecha de un elemento. 1 es opaco, 0 es transparente.",
  LINK_CTRL_CLICK_NAME:
    `${labelCTRL()}+CLICK en texto con [[enlaces]] o [](enlaces) para abrirlos`,
  LINK_CTRL_CLICK_DESC:
    "Puedes desactivar esta función si interfiere con otras funciones de Excalidraw que quieras usar. Si " +
    `la desactivas, puedes usar ${labelCTRL()} + ${labelMETA()} o el ícono de enlace en la esquina superior derecha del elemento para abrir los enlaces.`,
  TRANSCLUSION_WRAP_NAME: "Comportamiento de ajuste de texto transcluido",
  TRANSCLUSION_WRAP_DESC:
    "El número especifica el recuento de caracteres donde el texto debe ajustarse. " +
    "Establece el comportamiento de ajuste de texto para el texto transcluido. Activa esta opción para forzar el ajuste " +
    "del texto (es decir, sin desbordamiento) o desactívala para un ajuste suave (en el espacio en blanco más cercano).",
  TRANSCLUSION_DEFAULT_WRAP_NAME: "Ajuste de texto predeterminado para transclusión",
  TRANSCLUSION_DEFAULT_WRAP_DESC:
    "Puedes establecer o anular manualmente la longitud del ajuste de texto usando el formato `![[página#^bloque]]{NÚMERO}`. " +
    "Normalmente no querrás establecer un valor predeterminado, ya que si transcluyes texto dentro de una nota adhesiva, Excalidraw se encargará automáticamente del ajuste. " +
    "Establece este valor en `0` si no deseas establecer un valor predeterminado. ",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME: "Transclusión de página: máximo de caracteres",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "El número máximo de caracteres a mostrar de la página al transcluir una página completa con el " +
    "formato ![[página de markdown]].",
  QUOTE_TRANSCLUSION_REMOVE_NAME: "Transclusión de citas: eliminar el  '> ' inicial de cada línea",
  QUOTE_TRANSCLUSION_REMOVE_DESC: "Elimina el '> ' inicial de cada línea de la transclusión. Esto mejorará la legibilidad de las citas en transclusiones de solo texto.<br>" +
    "<b><u>Activado:</u></b> Elimina el '> ' inicial<br><b><u>Desactivado:</u></b> No elimina el '> ' inicial (tenga en cuenta que se seguirá eliminando de la primera línea debido a la funcionalidad de la API de Obsidian).",
  GET_URL_TITLE_NAME: "Usar iframely para resolver el título de la página",
  GET_URL_TITLE_DESC:
    "Usa <code>http://iframely.server.crestify.com/iframely?url=</code> para obtener el título de la página al soltar un enlace en Excalidraw.",
  PDF_TO_IMAGE: "PDF a Image",
  PDF_TO_IMAGE_SCALE_NAME: "Escala de conversión de PDF a imagen",
  PDF_TO_IMAGE_SCALE_DESC: "Establece la resolución de la imagen que se genera a partir de la página PDF. Una mayor resolución resultará en imágenes más grandes en la memoria y, por lo tanto, una mayor carga para tu sistema (rendimiento más lento), pero la imagen será más nítida. " +
    "Además, si quieres copiar páginas de PDF (como imágenes) a Excalidraw.com, un tamaño de imagen más grande podría exceder el límite de 2MB de Excalidraw.com.",
  EMBED_TOEXCALIDRAW_HEAD: "Incrustar archivos en Excalidraw",
  EMBED_TOEXCALIDRAW_DESC: "En la sección 'Incrustar archivos' de la Configuración de Excalidraw, puedes configurar cómo se incrustan varios tipos de archivos en Excalidraw. Esto incluye opciones para incrustar archivos Markdown interactivos, PDFs y archivos Markdown como imágenes.",
  MD_HEAD: "Incrustar Markdown en Excalidraw como imagen",
  MD_EMBED_CUSTOMDATA_HEAD_NAME: "Archivos Markdown interactivos",
  MD_EMBED_CUSTOMDATA_HEAD_DESC: `Las siguientes configuraciones solo afectarán a futuras incrustaciones. Las incrustaciones actuales no se modificarán. La configuración del tema de los marcos incrustados se encuentra en la sección "Apariencia y comportamiento de Excalidraw`,
  MD_EMBED_SINGLECLICK_EDIT_NAME: "Un solo click para editar Markdown incrustado",
  MD_EMBED_SINGLECLICK_EDIT_DESC:
    "Haz un solo click en un archivo Markdown incrustado para editarlo. " +
    "Cuando está desactivado, el archivo Markdown se abrirá primero en modo de vista previa, y luego cambiará a modo de edición cuando hagas click en él nuevamente.",
  MD_TRANSCLUDE_WIDTH_NAME: "Ancho predeterminado de un documento Markdown transcluido",
  MD_TRANSCLUDE_WIDTH_DESC:
    "El ancho de la página Markdown. Esto afecta el ajuste de texto al incrustar párrafos largos y el ancho " +
    "del elemento de imagen. Puedes anular el ancho predeterminado de " +
    "un archivo incrustado usando la sintaxis <code>[[nombre-de-archivo#encabezado|ANCHOxALTURA_MÁXIMA]]</code> en la vista de Markdown, bajo archivos incrustados.",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "Altura máxima predeterminada de un documento Markdown transcluido",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "La imagen incrustada tendrá la altura que requiera el texto Markdown, pero no superará este valor." +
    "Puedes anular este valor editando el enlace de la imagen incrustada en la vista de Markdown con la siguiente sintaxis  <code>[[nombre-de-archivo#^referencia-de-bloque|ANCHOxALTURA_MÁXIMA]]</code>.",
  MD_DEFAULT_FONT_NAME:
    "El tipo de letra de fuente predeterminado a usar para los archivos Markdown incrustados.",
  MD_DEFAULT_FONT_DESC:
    'Establece este valor en "Virgil" o "Cascadia" o en el nombre de archivo de una fuente válida <code>.ttf</code>, <code>.woff</code>, o <code>.woff2</code> por ejemplo <code>MiFuente.woff2</code> ' +
    "Puedes anular esta configuración añadiendo la siguiente clave de frontmatter al archivo Markdown incrustado: <code>excalidraw-font: fuente_o_nombre-de-archivo</code>",
  MD_DEFAULT_COLOR_NAME:
    "El color de fuente predeterminado a usar para los archivos Markdown incrustados.",
  MD_DEFAULT_COLOR_DESC:
    'Establece esto en cualquier nombre de color CSS válido, por ejemplo "steelblue" (<a href="https://www.w3schools.com/colors/colors_names.asp">nombres de colores</a>), o un color hexadecimal válido, por ejemplo "#e67700", ' +
    "o cualquier otra cadena de color CSS válida. Puedes anular esta configuración añadiendo la siguiente clave de frontmatter al archivo Markdown incrustado: <code>excalidraw-font-color: steelblue</code>",
  MD_DEFAULT_BORDER_COLOR_NAME:
    "El color de borde predeterminado a usar para los archivos Markdown incrustados.",
  MD_DEFAULT_BORDER_COLOR_DESC:
    'Establece esto en cualquier nombre de color CSS válido, por ejemplo "steelblue" (<a href="https://www.w3schools.com/colors/colors_names.asp">nombres de colores</a>), o un color hexadecimal válido, por ejemplo "#e67700", ' +
    "o cualquier otra cadena de color CSS válida. Puedes anular esta configuración añadiendo la siguiente clave de frontmatter al archivo Markdown incrustado: <code>excalidraw-border-color: gray</code>. " +
    "Deja el campo vacío si no quieres un borde. ",
  MD_CSS_NAME: "Archivo CSS",
  MD_CSS_DESC:
    "El nombre de archivo del CSS a aplicar a las incrustaciones de Markdown. Proporciona el nombre de archivo con la extensión (ej. 'md-embed.css'). El archivo CSS también puede ser un " +
    "archivo Markdown simple (ej. 'md-embed-css.md'), solo asegúrate de que el contenido esté escrito usando una sintaxis CSS válida. " +
    `Si necesitas ver el código HTML al que estás aplicando el CSS, abre la Consola de desarrollador de Obsidian (${DEVICE.isIOS || DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i"}) y escribe el siguiente comando: ` +
    '"ExcalidrawAutomate.mostRecentMarkdownSVG". Esto mostrará el SVG más reciente generado por Excalidraw. ' +
    "Configurar la familia de fuentes en el CSS tiene limitaciones. Por defecto, solo las fuentes estándar de tu sistema operativo están disponibles (consulta el archivo README para más detalles). " +
    "Puedes añadir una fuente personalizada más allá de eso usando la configuración de arriba. " +
    'Puedes anular esta configuración CSS añadiendo la siguiente clave de frontmatter al archivo Markdown incrustado: "excalidraw-css: archivo_css_en_la_bóveda|fragmento_css".',
  EMBED_HEAD: "Incrustar Excalidraw en tus notas y exportar",
  EMBED_DESC: `En la configuración de "Incrustar y exportar", puedes configurar cómo se incrustan y exportan las imágenes y los bosquejos de Excalidraw en tus documentos. Las configuraciones clave incluyen elegir el tipo de imagen para la vista previa de Markdown (como SVG nativo o PNG), especificar el tipo de archivo a insertar en el documento (Excalidraw original, PNG o SVG) y gestionar el almacenamiento en caché de imágenes para incrustarlas en Markdown. También puedes controlar el tamaño de la imagen, si incrustar los bosquejos usando wikienlaces o enlaces Markdown y ajustar la configuración relacionada con los temas de imagen, colores de fondo y la integración de Obsidian. 
    Además, hay configuraciones para la autoexportación, que genera automáticamente archivos SVG y/o PNG que coinciden con el título de tus bosquejos de Excalidraw, manteniéndolos sincronizados con los cambios de nombre y eliminaciones de archivos.`,
  EMBED_CANVAS: "Soporte para Obsidian Canvas",
  EMBED_CANVAS_NAME: "Incrustación inmersiva",
  EMBED_CANVAS_DESC: 
    "Oculta el borde y el fondo del nodo del Canvas al incrustar un bosquejo de Excalidraw en un Canvas. " +
    "Ten en cuenta que para un fondo completamente transparente en tu imagen, aún necesitarás configurar Excalidraw para que exporte las imágenes con fondo transparente.",
  EMBED_CACHING: "Caché de imágenes y optimización de renderizado",
  RENDERING_CONCURRENCY_NAME: "Concurrencia de renderizado de imágenes",
  RENDERING_CONCURRENCY_DESC:
    "Número de parallel workers(trabajadores paralelos) a usar para el renderizado de imágenes. Aumentar este número acelerará el proceso de renderizado, pero puede ralentizar el resto del sistema. " +
    "El valor predeterminado es 3. Puedes aumentar este número si tienes un sistema potente.",
  EXPORT_SUBHEAD: "Configuraciones de Exportación",
  EMBED_SIZING: "Tamaño de imagen",
  EMBED_THEME_BACKGROUND: "Tema de la imagen y color de fondo",
  EMBED_IMAGE_CACHE_NAME: "Guardar imágenes en caché para incrustar en Markdown",
  EMBED_IMAGE_CACHE_DESC: "Guarda imágenes en caché para incrustar en Markdown. Esto acelerará el proceso de incrustación, pero si compones imágenes a partir de varios bosquejos anidados, " +
    "la imagen incrustada en Markdown no se actualizará hasta que abras el bosquejo y lo guardes para activar la actualización del caché.",
  SCENE_IMAGE_CACHE_NAME: "Guardar bosquejos anidados de Excalidraw en caché en la escena",
  SCENE_IMAGE_CACHE_DESC: "Guarda los bosquejos anidados en caché para un renderizado más rápido. Esto acelerará el proceso de renderizado, especialmente si tienes muchos bosquejos anidados en tu escena. " + 
    "Excalidraw intentará identificar de manera inteligente si algún elemento de un bosquejo anidado ha cambiado y actualizará el caché. " +
    "Puede que quieras desactivar esta opción si sospechas que el caché no se está actualizando correctamente.",
  EMBED_IMAGE_CACHE_CLEAR: "Vaciar caché de imágenes",
  BACKUP_CACHE_CLEAR: "Eliminar copias de seguridad",
  BACKUP_CACHE_CLEAR_CONFIRMATION: "Esta acción eliminará todas las copias de seguridad de los bosquejos de Excalidraw. Las copias de seguridad se utilizan como medida de seguridad en caso de que tu archivo de bosquejo se dañe. Cada vez que abres Obsidian, el plugin elimina automáticamente las copias de seguridad de los archivos que ya no existen en tu Bóveda. ¿Estás seguro de que quieres borrar todas las copias de seguridad?",
  EMBED_REUSE_EXPORTED_IMAGE_NAME:
    "Si se encuentra, usar la imagen ya exportada para la vista previa",
  EMBED_REUSE_EXPORTED_IMAGE_DESC:
    "Esta configuración funciona en conjunto con la opción de <a href='#"+TAG_AUTOEXPORT+"'>Auto-exportar SVG/PNG</a>.Si hay una imagen exportada que coincide con el nombre del archivo del bosquejo " +
    "disponible, se usará esa imagen en lugar de generar una vista previa al momento. Esto resultará en vistas previas más rápidas, especialmente si tienes muchos objetos incrustados en el bosquejo. Sin embargo, " +
    "puede que tus últimos cambios no se muestren y la imagen no coincida automáticamente con el " +
    "tema de Obsidian si lo has cambiado desde que se creó la exportación. Esta configuración solo se aplica a la incrustación de imágenes en documentos Markdown.  " +
    "Por diversas razones, el mismo enfoque no se puede usar para acelerar la carga de bosquejos con muchos objetos incrustados. Puedes ver una demostración <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag/1.6.23' target='_blank'>aquí</a>.",
  /*EMBED_PREVIEW_SVG_NAME: "Mostrar SVG en la vista previa de Markdown",
  EMBED_PREVIEW_SVG_DESC:
    "<b><u>Activado:</u></b> Incrustar el bosquejo como una imagen <a href='https://en.wikipedia.org/wiki/Scalable_Vector_Graphics' target='_blank'>SVG</a> en la vista previa de Markdown.<br>" +
    "<b><u>Desactivado:</u></b> Incrustar el bosquejo como una imagen <a href='' target='_blank'>PNG</a>. Ten en cuenta que algunas de las <a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>funciones de referencia de bloque de imagen</a> no funcionan con las incrustaciones PNG.",*/
  EMBED_PREVIEW_IMAGETYPE_NAME: "Tipo de imagen en la vista previa de Markdown",
  EMBED_PREVIEW_IMAGETYPE_DESC:
    "<b><u>SVG Nativo</u></b>: Alta calidad de imagen. Los sitios web incrustados, videos de YouTube, enlaces de Obsidian e imágenes externas incrustadas a través de una URL funcionarán. Las páginas de Obsidian incrustadas no<br>" +
    "<b><u>Imagen SVG</u></b>: Alta calidad de imagen. Los elementos incrustados e imágenes incrustadas a través de una URL solo tienen marcadores de posición; los enlaces no funcionan.<br>" +
    "<b><u>Imagen PNG</u></b>: Menor calidad de imagen, pero en algunos casos mejor rendimiento con bosquejos grandes. Los elementos incrustados e imágenes incrustadas a través de una URL solo tienen marcadores de posición; los enlaces no funcionan. Además, algunas de las <a href='https://www.youtube.com/watch?v=yZQoJg2RCKI&t=633s' target='_blank'>funciones de referencia de bloque de imagen</a> no funcionan con las incrustaciones PNG.", 
  PREVIEW_MATCH_OBSIDIAN_NAME: "Vista previa de Excalidraw para que coincida con el tema de Obsidian",
  PREVIEW_MATCH_OBSIDIAN_DESC:
    "La vista previa de la imagen en los documentos debe coincidir con el tema de Obsidian. Si está habilitado, cuando Obsidian esté en modo oscuro, las imágenes de Excalidraw se renderizarán en modo oscuro. " +
    "Cuando Obsidian esté en modo claro, Excalidraw también se renderizará en modo claro. Es posible que quieras desactivar 'Exportar imagen con fondo' para una apariencia más integrada con Obsidian.",
  EMBED_WIDTH_NAME: "Ancho predeterminado de la imagen incrustada (transcluida)",
  EMBED_WIDTH_DESC:
    "El ancho predeterminado de un bosquejo incrustado. Esto se aplica al modo de edición de vista en vivo y al modo de lectura, así como a las vistas previas al pasar el cursor. Puedes especificar un " +
    "ancho personalizado al incrustar una imagen usando el formato <code>![[bosquejo.excalidraw|100]]</code> o " +
    "<code>[[bosquejo.excalidraw|100x100]]</code>.",
  EMBED_HEIGHT_NAME: "Altura predeterminada de la imagen incrustada (transcluida)",
  EMBED_HEIGHT_DESC:
    "TLa altura predeterminada de un bosquejo incrustado. Esto se aplica al modo de edición de vista en vivo y al modo de lectura, así como a las vistas previas al pasar el cursor. Puedes especificar  " +
    "una altura personalizada al incrustar una imagen usando el formato <code>![[bosquejo.excalidraw|100]]</code> o " +
    "<code>[[bosquejo.excalidraw|100x100]]</code>.",
  EMBED_TYPE_NAME: "Tipo de archivo a insertar en el documento",
  EMBED_TYPE_DESC:
    "Cuando incrustas una imagen en un documento usando la paleta de comandos, esta configuración especificará si Excalidraw debe incrustar el archivo original de Excalidraw " +
    "o una copia PNG o SVG. Debes habilitar <a href='#"+TAG_AUTOEXPORT+"'>auto-exportar PNG / SVG</a> (ver abajo en Configuración de Exportación) para que esos tipos de imagen estén disponibles en el menú desplegable. Para los bosquejos que no tengan " +
    "PNG o SVG correspondiente disponible, la acción de la paleta de comandos insertará un enlace roto. Tendrás que abrir el bosquejo original e iniciar la exportación manualmente. " +
    "Esta opción no generará automáticamente archivos PNG/SVG, sino que simplemente hará referencia a los archivos ya existentes.",
  EMBED_MARKDOWN_COMMENT_NAME: "Incrustar enlace al bosquejo como comentario",
  EMBED_MARKDOWN_COMMENT_DESC: 
    "Incrusta el enlace al archivo original de Excalidraw como un enlace Markdown debajo de la imagen, ej:<code>%%[[bosquejo.excalidraw]]%%</code>.<br>" +
    "En lugar de añadir un comentario de Markdown, también puedes seleccionar la línea del SVG o PNG incrustado y usar la acción de la paleta de comandos: " +
    "'<code>Excalidraw: Abrir bosquejo de Excalidraw</code>' para abrir el bosquejo.",
  EMBED_WIKILINK_NAME: "Incrustar bosquejo usando un enlace Wiki",
  EMBED_WIKILINK_DESC:
    "<b><u>Activado:</u></b> Excalidraw incrustará un [[enlace wiki]].<br><b><u>Desactivado:</u></b> Excalidraw incrustará un [markdown](enlace).",
  EXPORT_PNG_SCALE_NAME: "Escala de la imagen exportada en PNG",
  EXPORT_PNG_SCALE_DESC: "La escala de tamaño de la imagen PNG exportada.",
  EXPORT_BACKGROUND_NAME: "Exportar imagen con fondo",
  EXPORT_BACKGROUND_DESC:
    "Si está desactivado, la imagen exportada será transparente.",
  EXPORT_PADDING_NAME: "Relleno de imagen",
  EXPORT_PADDING_DESC:
    "El relleno (en píxeles) alrededor de la imagen SVG o PNG exportada. El relleno se establece en 0 para las referencias clippedFrame" +
    "Si tienes líneas curvas cerca del borde de la imagen, es posible que se recorten durante la exportación. Puedes aumentar este valor para evitar el recorte. " +
    "También puedes anular esta configuración a nivel de archivo añadiendo la clave frontmatter <code>excalidraw-export-padding: 5<code>.",
  EXPORT_THEME_NAME: "Exportar imagen con el tema",
  EXPORT_THEME_DESC:
    "Exporta la imagen coincidiendo con el tema claro/oscuro de tu bosquejo. Si está desactivado, " +
    "los bosquejos creados en modo oscuro aparecerán como lo harían en modo claro.",
  EXPORT_EMBED_SCENE_NAME: "Incrustar escena en la imagen exportada",
  EXPORT_EMBED_SCENE_DESC:
    "Incrusta la escena de Excalidraw en la imagen exportada. Se puede anular a nivel de archivo añadiendo la clave frontmatter <code>excalidraw-export-embed-scene: true/false<code> . " +
    "La configuración solo surtirá efecto la próxima vez que (re)abras los bosquejos.",
  PDF_EXPORT_SETTINGS: "Configuración de exportación a PDF",
  EXPORT_HEAD: "Configuración de auto-exportación",
  EXPORT_SYNC_NAME:
    "Mantiene los nombres de archivo .SVG y/o .PNG sincronizados con el archivo del bosquejo",
  EXPORT_SYNC_DESC:
    "Cuando está activado, el plugin actualizará automáticamente el nombre de los archivos .SVG y/o .PNG cuando el bosquejo en la misma carpeta (y con el mismo nombre) sea renombrado. " +
    "El complemento también eliminará automáticamente los archivos .SVG y/o .PNG cuando el bosquejo en la misma carpeta (y con el mismo nombre) sea eliminado. ",
  EXPORT_SVG_NAME: "Auto-exportar SVG",
  EXPORT_SVG_DESC:
    "Crea automáticamente una exportación SVG de tu bosquejo que coincida con el título de tu archivo. " +
    "El complemento guardará el archivo *.SVG en la misma carpeta que el bosquejo. " +
    "Incrustar el archivo .svg en tus documentos hace que tus incrustaciones sean independientes de la plataforma. " +
    "Mientras el interruptor de autoexportación esté activado, este archivo se actualizará cada vez que edites el bosquejo de Excalidraw con el nombre correspondiente. " + 
    "Puedes anular esta configuración a nivel de archivo añadiendo la clave frontmatter <code>excalidraw-autoexport</code>. Los valores válidos para esta clave son " +
    "<code>none</code>,<code>both</code>,<code>svg</code>, y <code>png</code>.",
  EXPORT_PNG_NAME: "Auto-exportar PNG",
  EXPORT_PNG_DESC: "Igual que la autoexportación de SVG, pero para *.PNG",
  EXPORT_BOTH_DARK_AND_LIGHT_NAME: "Exportar imagen con tema oscuro y claro",
  EXPORT_BOTH_DARK_AND_LIGHT_DESC:  "Cuando está habilitado, Excalidraw exportará dos archivos en lugar de uno: nombre-archivo.dark.png, nombre-archivo.light.png y/o nombre-archivo.dark.svg y nombre-archivo.light.svg<br>"+
    "Se exportarán archivos dobles tanto si la autoexportación de SVG o PNG (o ambos) está habilitada, como al hacer clic en exportar en una sola imagen.",
  COMPATIBILITY_HEAD: "Funciones de compatibilidad",
  COMPATIBILITY_DESC: "Solo debes habilitar estas funciones si tienes una razón de peso para querer trabajar con archivos de excalidraw.com en lugar de archivos Markdown. Muchas de las funciones del plugin no son compatibles con los archivos heredados. Un caso de uso típico sería si configuras tu bóveda sobre una carpeta de proyecto de Visual Studio Code y también quieres acceder a los bosquejos .excalidraw desde allí. Otro caso de uso podría ser usar Excalidraw en Logseq y Obsidian en paralelo.",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME: "Linter compatibility",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC: "Excalidraw es sensible a la estructura del archivo debajo de <code># Excalidraw Data</code>. La revisión automática de documentos (linting) puede crear errores en los datos de Excalidraw. " +
    "Si bien he hecho un esfuerzo para que la carga de datos sea resistente a los " +
    "cambios de lint, esta solución no es infalible.<br><mark>Lo mejor es evitar el linting o la modificación automática de documentos de Excalidraw usando otros complementos.</mark><br>" +
    "Usa esta configuración si, por buenas razones, has decidido ignorar mi recomendación y configuraste el linting para archivos de Excalidraw.<br> " +
    "La sección <code>## Text Elements</code> es sensible a las líneas vacías. Un enfoque de linting común es agregar una línea vacía después de los encabezados de sección. En el caso de Excalidraw, esto romperá o cambiará el primer elemento de texto de tu bosquejo. " +
    "Para solucionar esto, puedes habilitar esta configuración. Cuando está habilitada, Excalidraw agregará un elemento ficticio al inicio de <code>## Text Elements</code> que el linter puede modificar de forma segura." ,
  PRESERVE_TEXT_AFTER_DRAWING_NAME: "Compatibilidad con Zotero y notas al pie",
  PRESERVE_TEXT_AFTER_DRAWING_DESC: "Preserva el texto después de la sección ## Bosquejo del archivo Markdown. Esto puede tener un impacto muy leve en el rendimiento al guardar bosquejos muy grandes.",
  DEBUGMODE_NAME: "Habilitar mensajes de depuración",
  DEBUGMODE_DESC: "Recomiendo reiniciar Obsidian después de habilitar o deshabilitar esta configuración. Esto habilita los mensajes de depuración en la consola. Esto es útil para solucionar problemas. " +
    "Si estás experimentando problemas con el plugin, por favor, habilita esta configuración, reproduce el problema e incluye el registro de la consola en el problema que reportes en <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/issues'>GitHub</a>",
  SLIDING_PANES_NAME: "Soporte para el complemento Sliding Panes",
  SLIDING_PANES_DESC:
    "Necesitas reiniciar Obsidian para que este cambio surta efecto.<br>" +
    "Si usas el <a href='https://github.com/deathau/sliding-panes-obsidian' target='_blank'>complemento Sliding Panes</a> " +
    ", puedes habilitar esta configuración para que los bosquejos de Excalidraw funcionen con él.<br>" +
    "Ten en cuenta que el soporte de Excalidraw para Sliding Panes causa problemas de compatibilidad con los Workspaces(Espacios de Trabajo) de Obsidian.<br>" +
    "Ten en cuenta también que la función 'Stack Tabs' ya está disponible en Obsidian, lo que proporciona soporte nativo para la mayoría de las funcionalidades de Sliding Panes.",
  EXPORT_EXCALIDRAW_NAME: "Auto-exportar Excalidraw",
  EXPORT_EXCALIDRAW_DESC: "Igual que la autoexportación de SVG, pero para *.Excalidraw",
  SYNC_EXCALIDRAW_NAME:
    "Sincronizar *.excalidraw con la versión *.md del mismo bosquejo",
  SYNC_EXCALIDRAW_DESC:
    "Si la fecha de modificación del archivo *.excalidraw es más reciente que la fecha de modificación del archivo *.md, " +
    "entonces actualiza el bosquejo en el archivo .md basándose en el archivo .excalidraw.",
  COMPATIBILITY_MODE_NAME: "Nuevos bosquejos como archivos heredados",
  COMPATIBILITY_MODE_DESC:
    "⚠️ Habilita esto solo si sabes lo que estás haciendo. En el 99.9% de los casos NO querrás tener esto activado. " +
    "Al habilitar esta función, los bosquejos que crees con el icono de la barra, las acciones de la paleta de comandos " +
    "y el explorador de archivos serán todos archivos heredados *.excalidraw . Esta configuración también desactivará el mensaje de recordatorio " +
    "cuando abras un archivo heredado para editar.",
  MATHJAX_NAME: "Host(Servidor) de la librería Javascript MathJax(LaTeX)",
  MATHJAX_DESC: "Si estás usando ecuaciones LaTeX en Excalidraw, el complemento necesita cargar una librería de Javascript para ello. " + 
    "Algunos usuarios no pueden acceder a ciertos servidores. Si tienes problemas, intenta cambiar el servidor aquí. Es posible que necesites"+
    "reiniciar Obsidian después de cerrar la configuración para que este cambio surta efecto.",
  LATEX_DEFAULT_NAME: "Fórmula LaTeX predeterminada para nuevas ecuaciones",
  LATEX_DEFAULT_DESC: "Deja vacío si no quieres una fórmula predeterminada. Puedes añadir formato predeterminado aquí, como <code>\\color{white}</code>.",
  LATEX_PREAMBLE_NAME: "Archivo preámbulo de LaTeX (¡Sensible a MAYÚSCULAS/minúsculas!)",
  LATEX_PREAMBLE_DESC: "Ruta de archivo completa al preámbulo; deja vacío para usar el predeterminado. Si el archivo no existe, esta opción será ignorada.<br><strong>Importante:</strong> Requiere recargar Obsidian para que el cambio surta efecto!",
  NONSTANDARD_HEAD: "Funciones no compatibles con Excalidraw.com",
  NONSTANDARD_DESC: `Estas configuraciones en la sección "Funciones no compatibles con Excalidraw.com" ofrecen opciones de personalización que van más allá de las funciones predeterminadas de Excalidraw.com. Estas funciones no están disponibles en excalidraw.com. Al exportar el bosquejo a Excalidraw.com, estas funciones se verán diferentes.
    Puedes configurar el número de lápices personalizados que se muestran junto al Menú de Obsidian en el lienzo, permitiéndote elegir entre una variedad de opciones. Además, puedes habilitar una opción de fuente local, que agrega una fuente local a la lista de fuentes en el panel de propiedades de elementos de texto. `,
  RENDER_TWEAK_HEAD: "Ajustes de renderizado",
  MAX_IMAGE_ZOOM_IN_NAME: "Resolución máxima de zoom en imágenes",
  MAX_IMAGE_ZOOM_IN_DESC: "Para ahorrar memoria y debido a que Apple Safari (Obsidian en iOS) tiene algunas limitaciones codificadas, excalidraw.com limita la resolución máxima de las imágenes y objetos grandes al hacer zoom. Puedes anular esta limitación usando un multiplicador. " +
    "Esto significa que multiplicas el límite establecido por defecto en Excalidraw; cuanto mayor sea el multiplicador, mejor será la resolución de zoom de la imagen y más memoria consumirá. " +
    "Te recomiendo experimentar con varios valores. Sabrás que has llegado al límite cuando al hacer zoom en una imagen PNG grande, esta desaparezca de la vista. El valor predeterminado es 1. Esta configuración no tiene efecto en iOS.",
  CUSTOM_PEN_HEAD: "Lápices personalizados",
  CUSTOM_PEN_NAME: "Número de lápices personalizados",
  CUSTOM_PEN_DESC: "Verás estos lápices junto al Menú de Obsidian en el lienzo. Puedes personalizarlos manteniendo presionado el botón del lápiz en el lienzo.",
  EXPERIMENTAL_HEAD: "Funcionalidades misceláneas",
  EXPERIMENTAL_DESC: `Estas funcionalidades misceláneas en Excalidraw incluyen opciones para establecer fórmulas LaTeX predeterminadas para nuevas ecuaciones, habilitar un sugeridor de campos para autocompletar, mostrar indicadores de tipo para archivos de Excalidraw, habilitar la incrustación de imágenes inmersivas en el modo de edición de vista en vivo y experimentar con el Reconocimiento Óptico de Caracteres (OCR) de Taskbone para la extracción de texto de imágenes y bosquejos. Los usuarios también pueden ingresar una clave de API de Taskbone para un uso extendido del servicio de OCR.`,
  EA_HEAD: "Excalidraw Automate",
  EA_DESC: 
    "ExcalidrawAutomate es una API de scripting y automatización para Excalidraw. Desafortunadamente, la documentación de la API es escasa. " +
    "Te recomiendo leer el archivo <a href='https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/docs/API/ExcalidrawAutomate.d.ts'>ExcalidrawAutomate.d.ts</a>, " +
    "visitar la página <a href='https://zsviczian.github.io/obsidian-excalidraw-plugin/'>Cómo usar ExcalidrawAutomate</a> (aunque la información " +
          "aquí no se ha actualizado en mucho tiempo), y finalmente, habilitar el sugeridor de campos que se encuentra abajo. El sugeridor de campos te mostrará las funciones disponibles,  " +
    "sus parámetros y una breve descripción mientras escribes. El sugeridor de campos es la documentación más actualizada de la API.",
  FIELD_SUGGESTER_NAME: "Habilitar Sugeridor de Campos",
  FIELD_SUGGESTER_DESC:
    "El sugeridor de campos, tomado de los plugins Breadcrumbs y Templater, mostrará un menú de autocompletar " +
    "cuando escribas <code>excalidraw-</code> o <code>ea.</code> , con descripciones de las funciones como pistas para cada elemento en la lista.",
  STARTUP_SCRIPT_NAME: "Script de inicio",
  STARTUP_SCRIPT_DESC:
    "Si está configurado, Excalidraw ejecutará el script al iniciar el plugin. Esto es útil si quieres establecer cualquiera de los hooks de Excalidraw Automate. El script de inicio es un archivo Markdown " +
    "que debe contener el código Javascript que quieres ejecutar cuando Excalidraw se inicie",
  STARTUP_SCRIPT_BUTTON_CREATE: "Crear script de inicio",
  STARTUP_SCRIPT_BUTTON_OPEN: "Abrir script de inicio",
  STARTUP_SCRIPT_EXISTS: "El archivo del script de inicio ya existe",
  FILETYPE_NAME: "Muestra el indicador de tipo (✏️) para archivos excalidraw.md en el Explorador de archivos",
  FILETYPE_DESC:
    "Los archivos de Excalidraw recibirán un indicador usando el emoji o texto definido en la siguiente configuración.",
  FILETAG_NAME: "Establecer el indicador de tipo para archivos excalidraw.md",
  FILETAG_DESC: "El texto o emoji a mostrar como indicador de tipo.",
  INSERT_EMOJI: "Insertar un emoji",
  LIVEPREVIEW_NAME: "Incrustación de imágenes inmersiva en modo de edición de vista en vivo",
  LIVEPREVIEW_DESC:
    "Activa esta opción para admitir estilos de incrustación de imágenes como ![[bosquejo|ancho|estilo]] en el modo de edición de vista en vivo. " +
    "Esta configuración no afectará los documentos abiertos actualmente. Debes cerrar los documentos y volver a abrirlos " +
    "para que el cambio surta efecto.",
  FADE_OUT_EXCALIDRAW_MARKUP_NAME: "Desvanecer el marcado de Excalidraw",
  FADE_OUT_EXCALIDRAW_MARKUP_DESC: "En el modo de vista Markdown, la sección después del comentario de Markdown %% " +
    "se desvanece. El texto sigue ahí, pero la saturación visual se reduce. Ten en cuenta que puedes colocar el %% en la línea justo encima de # Text Elements, " +
    "en ese caso, todo el Markdown del bosquejo se desvanecerá, incluyendo # Text Elements. El efecto secundario es que no podrás hacer referencia a bloques de texto en otras notas Markdown que estén después de la sección de comentarios %% . Esto rara vez es un problema. " +
    "i necesitas editar el script Markdown de Excalidraw, simplemente cambia al modo de vista Markdown y elimina temporalmente el comentario %% .",
  EXCALIDRAW_PROPERTIES_NAME: "Cargar propiedades de Excalidraw en el sugeridor de Obsidian",
  EXCALIDRAW_PROPERTIES_DESC: "Activa esta configuración para cargar las propiedades de los documentos de Excalidraw en el sugeridor de propiedades de Obsidian al iniciar el complemento. "+
   "Habilitar esta función simplifica el uso de las propiedades de frontmatter de Excalidraw, permitiéndote aprovechar muchas configuraciones poderosas. Si prefieres no cargar estas propiedades automáticamente, " +
   "puedes deshabilitar esta función, pero tendrás que eliminar manualmente cualquier propiedad no deseada del sugeridor. " +
   "Ten en cuenta que activar esta configuración requiere reiniciar el plugin, ya que las propiedades se cargan al inicio.",  
  FONTS_HEAD: "Fuentes",
  FONTS_DESC: "Configura los tipos de letra locales y las fuentes CJK (chino, japonés y coreano) descargadas para Excalidraw.",
  CUSTOM_FONT_HEAD: "Fuente local",
  ENABLE_FOURTH_FONT_NAME: "Habilitar opción de fuente local",
  ENABLE_FOURTH_FONT_DESC:
    "Habilitar esta opción añadirá una fuente local a la lista de fuentes en el panel de propiedades para elementos de texto. " +
    "Ten en cuenta que el uso de esta fuente local puede comprometer la independencia de la plataforma. " +
    "Los archivos que utilicen la fuente personalizada podrían renderizarse de forma diferente al ser abiertos en otra bóveda o en un momento posterior, dependiendo de la configuración de la fuente. " +
    "Además, la 4ta(cuarta) fuente se establecerá por defecto como la fuente del sistema en excalidraw.com o en otras versiones de Excalidraw.",
  FOURTH_FONT_NAME: "Archivo de fuente local",
  FOURTH_FONT_DESC:
    "Selecciona un archivo de fuente .otf, .ttf, .woff o .woff2 de tu bóveda para usarlo como fuente local. " +
    "Si no se selecciona ningún archivo, Excalidraw usará la fuente Virgil por defecto. " +
    "Para un rendimiento óptimo, se recomienda usar un archivo .woff2, ya que Excalidraw solo codificará los glifos necesarios al exportar imágenes a SVG. " +
    "Otros formatos de fuente incrustarán la fuente completa en el archivo exportado, lo que podría resultar en tamaños de archivo significativamente mayores.",
  OFFLINE_CJK_NAME: "Soporte de fuentes CJK (chino, japonés y coreano) sin conexión",
  OFFLINE_CJK_DESC: 
    `<strong>Los cambios que hagas aquí solo se aplicarán después de reiniciar Obsidian.</strong><br>
     Excalidraw.com ofrece fuentes CJK (chino, japonés, coreano) escritas a mano. Por defecto, estas fuentes no se incluyen en el plugin de forma local, sino que se obtienen de internet. 
     Si prefieres que Excalidraw funcione completamente sin conexión a internet, puedes descargar los <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip" target="_blank">archivos de fuentes necesarios desde GitHub</a>.
     Después de descargarlos, descomprime el contenido en una carpeta dentro de tu Bóveda.<br>
     La precarga de fuentes afectará el rendimiento al iniciar. Por esta razón, puedes seleccionar qué fuentes cargar.`,
  CJK_ASSETS_FOLDER_NAME: "Carpeta de fuentes CJK (¡Sensible a MAYÚSCULAS/minúsculas!)",
  CJK_ASSETS_FOLDER_DESC: `Puedes establecer la ubicación de la carpeta de fuentes CJK aquí. Por ejemplo, podrías elegir colocarla en una carpeta llamada <code>Excalidraw/Fuentes CJK</code>.<br><br>
    <strong>Importante:</strong> ¡No establezcas esta carpeta en la raíz de tu Bóveda! No coloques otras fuentes en esta carpeta.<br><br>
    <strong>Nota:</strong> Si usas Obsidian Sync y quieres sincronizar estos archivos de fuentes en tus dispositivos, asegúrate de que Obsidian Sync esté configurado para sincronizar "Todos los demás tipos de archivo"`, 
  LOAD_CHINESE_FONTS_NAME: "Cargar fuentes chinas desde el archivo al inicio",
  LOAD_JAPANESE_FONTS_NAME: "Cargar fuentes japonesas desde el archivo al inicio",
  LOAD_KOREAN_FONTS_NAME: "Cargar fuentes coreanas desde el archivo al inicio",
  SCRIPT_SETTINGS_HEAD: "Configuración para scripts instalados",
  SCRIPT_SETTINGS_DESC: "Algunos de los scripts de Excalidraw Automate incluyen configuraciones. Las configuraciones están organizadas por script. Solo se harán visibles en esta lista después de que hayas ejecutado el script recién descargado al menos una vez.",
  TASKBONE_HEAD: "Reconocimiento Óptico de Caracteres de Taskbone",
  TASKBONE_DESC: "Esta es una integración experimental del reconocimiento óptico de caracteres en Excalidraw. Ten en cuenta que Taskbone es un servicio externo independiente y no es proporcionado por Excalidraw ni por el proyecto del complemento Excalidraw-Obsidian. " +
    "El servicio de OCR capturará texto legible de las líneas de dibujo a mano alzada y de las imágenes incrustadas en tu lienzo y colocará el texto reconocido en el frontmatter de tu bosquejo, así como en el portapapeles. " +
    "Tener el texto en el frontmatter te permitirá buscar su contenido en Obsidian. " +
    "Ten en cuenta que el proceso de extracción de texto de la imagen no se realiza de forma local, sino a través de una API en línea. El servicio de Taskbone almacena la imagen en sus servidores solo durante el tiempo necesario para la extracción de texto. Sin embargo, si esto es un inconveniente para ti, por favor no uses esta función.",
  TASKBONE_ENABLE_NAME: "Habilitar Taskbone",
  TASKBONE_ENABLE_DESC: "Al habilitar este servicio, aceptas los <a href='https://www.taskbone.com/legal/terms/' target='_blank'>Términos y Condiciones</a> y la " +
    "<a href='https://www.taskbone.com/legal/privacy/' target='_blank'>Política de Privacidad</a> de Taskbone.",
  TASKBONE_APIKEY_NAME: "Clave API(API Key) de Taskbone",
  TASKBONE_APIKEY_DESC: "Taskbone ofrece un servicio gratuito con un número razonable de escaneos al mes. Si quieres usar esta función con más frecuencia, o si quieres apoyar " + 
    "al desarrollador de Taskbone (como puedes imaginar, no existe el 'gratis', proporcionar este increíble servicio de OCR le cuesta dinero al desarrollador de Taskbone), " +
    "puedes comprar una clave API(API Key) de pago en <a href='https://www.taskbone.com/' target='_blank'>taskbone.com</a>. En caso de que hayas comprado una clave, simplemente sobrescribe esta clave API(API Key) gratuita generada automáticamente con tu clave de pago.",

  //HotkeyEditor
  HOTKEY_PRESS_COMBO_NANE: "Presiona tu combinación de atajos",
  HOTKEY_PRESS_COMBO_DESC: "Por favor, presiona la combinación de teclas deseada para el atajo.",
  HOTKEY_BUTTON_ADD_OVERRIDE: "Agregar nueva sobrescritura de atajo",
  HOTKEY_BUTTON_REMOVE: "Eliminar atajo",

  //openDrawings.ts
  SELECT_FILE: "Selecciona un archivo y luego presiona Enter.",
  SELECT_COMMAND: "Selecciona un comando y luego presiona Enter.",
  SELECT_FILE_WITH_OPTION_TO_SCALE: `Selecciona un archivo y luego presiona ENTER, o ${labelSHIFT()}+${labelMETA()}+ENTER para insertar a escala del 100%`,
  NO_MATCH: "Ningún archivo coincide con tu búsqueda.",
  NO_MATCHING_COMMAND: "Ningún comando coincide con tu búsqueda.",
  SELECT_FILE_TO_LINK: "Selecciona el archivo para el que quieres insertar el enlace.",
  SELECT_COMMAND_PLACEHOLDER: "Selecciona el comando para el que quieres insertar el enlace.",
  SELECT_DRAWING: "Selecciona el bosquejo que quieres insertar.",
  TYPE_FILENAME: "Escribe el nombre del bosquejo para seleccionar.",
  SELECT_FILE_OR_TYPE_NEW:
    "Selecciona un bosquejo existente o escribe el nombre de uno nuevo y luego presiona Enter.",
  SELECT_TO_EMBED: "Selecciona el bosquejo para insertar en el documento activo.",
  SELECT_MD: "Selecciona el documento Markdown que quieres insertar",
  SELECT_PDF: "Selecciona el documento PDF que quieres insertar.",
  PDF_PAGES_HEADER: "¿Páginas a cargar?",
  PDF_PAGES_DESC: "Formato: 1, 3-5, 7, 9-11",

  //SelectCard.ts
  TYPE_SECTION: "Escribe el nombre de la sección para seleccionar.",
  SELECT_SECTION_OR_TYPE_NEW:
    "Selecciona una sección existente o escribe el nombre de una nueva y luego presiona Enter.",
  INVALID_SECTION_NAME: "Nombre de sección inválido.",
  EMPTY_SECTION_MESSAGE: "Escribe el nombre de la sección y presiona Enter para crear una nueva.",

  //EmbeddedFileLoader.ts
  INFINITE_LOOP_WARNING:
    "ADVERTENCIA DE EXCALIDRAW\nCarga de imágenes incrustadas abortada debido a un bucle infinito en el archivo:\n",

  //Scripts.ts
  SCRIPT_EXECUTION_ERROR:
    "Error de ejecución del script. Por favor, revisa la consola del desarrollador para ver el mensaje de error.",

  //ExcalidrawData.ts
  LOAD_FROM_BACKUP: "El archivo de Excalidraw estaba dañado. Cargando desde el archivo de backup(copia de seguridad).",
  FONT_LOAD_SLOW: "Cargando fuentes...\n\n Esto está tomando más tiempo de lo esperado. Si este retraso ocurre regularmente, puedes descargar las fuentes de forma local en tu Bóveda. \n\n" +
    "(Click_izquierdo=para-descartar,Click_derecho=para-más-información).",
  FONT_INFO_TITLE: "A partir de la versión 2.5.3, las fuentes se cargan desde internet.",
  FONT_INFO_DETAILED: `
      <p>
        Para mejorar el tiempo de inicio de Obsidian y gestionar la gran <strong>familia de fuentes CJK</strong>, 
        moví las fuentes CJK del archivo <code>main.js</code> del complemento. Ahora, las fuentes CJK se cargarán desde internet por defecto.
        Esto no debería causar problemas, ya que Obsidian almacena estos archivos en caché después del primer uso.
      </p>
      <p>
        Si prefieres mantener Obsidian 100% local o experimentas problemas de rendimiento, puedes descargar los archivos de fuentes.
      </p>
      <h3>Instrucciones:</h3>
      <ol>
        <li>Descarga las fuentes desde <a href="https://github.com/zsviczian/obsidian-excalidraw-plugin/raw/refs/heads/master/assets/excalidraw-fonts.zip">GitHub</a>.</li>
        <li>Descomprime y copia los archivos en una carpeta de tu Bóveda (por defecto: <code>Excalidraw/${CJK_FONTS}</code>; los nombres de las carpetas son sensibles a MAYÚSCULAS y minúsculas).</li>
        <li><mark>NO</mark> configures esta carpeta como la raíz de la Bóveda ni la combines con otras fuentes locales.</li>
      </ol>
      <h3>Para usuarios de Obsidian Sync:</h3>
      <p>
        Asegúrate de que Obsidian Sync esté configurado para sincronizar "Todos los demás tipos de archivo" o descarga y descomprime el archivo en todos los dispositivos.
      </p>
      <h3>Nota:</h3>
      <p>
        Si este proceso te parece complicado, por favor, envía una solicitud de función a Obsidian.md para que den soporte a los archivos de recursos en la carpeta del complemento. 
        Actualmente, solo se admite un único <code>main.js</code>, lo que resulta en archivos grandes y tiempos de inicio lentos para complementos complejos como Excalidraw. 
        Te pido disculpas por los inconvenientes.
      </p>
    `,

  //ObsidianMenu.tsx
  GOTO_FULLSCREEN: "Ir a modo de pantalla completa",
  EXIT_FULLSCREEN: "Salir de modo de pantalla completa",
  TOGGLE_FULLSCREEN: "Alternar modo de pantalla completa",
  TOGGLE_DISABLEBINDING: "Alternar para invertir el comportamiento de enlace predeterminado",
  TOGGLE_FRAME_RENDERING: "Alternar renderizado de marco(frame)",
  TOGGLE_FRAME_CLIPPING: "Alternar recorte de marco(frame)",
  OPEN_LINK_CLICK: "Abrir Enlace",
  OPEN_LINK_PROPS: "Abrir el editor de enlaces de imagen o de fórmulas-LaTeX",

  //IFrameActionsMenu.tsx
  NARROW_TO_HEADING: "Limitar a encabezado...",
  PIN_VIEW: "Fijar vista",
  DO_NOT_PIN_VIEW: "No fijar vista",
  NARROW_TO_BLOCK: "Limitar a bloque...",
  SHOW_ENTIRE_FILE: "Mostrar archivo completo",
  SELECT_SECTION: "Seleccionar sección del documento",
  SELECT_VIEW: "Seleccionar vista desde la base",
  ZOOM_TO_FIT: "Zoom para ajustar",
  RELOAD: "Recargar enlace original",
  OPEN_IN_BROWSER: "Abrir enlace actual en el navegador",
  PROPERTIES: "Propiedades",
  COPYCODE: "Copiar fuente al portapapeles",

  //EmbeddableSettings.tsx
  ES_TITLE: "Configuración de elementos incrustables",
  ES_RENAME: "Renombrar archivo",
  ES_ZOOM: "Escala del contenido incrustado",
  ES_YOUTUBE_START: "Tiempo de inicio de YouTube",
  ES_YOUTUBE_START_DESC: "ss, mm:ss, hh:mm:ss",
  ES_YOUTUBE_START_INVALID: "El tiempo de inicio de YouTube es inválido. Por favor, revisa el formato e inténtalo de nuevo.",
  ES_FILENAME_VISIBLE: "Nombre de archivo visible",
  ES_BACKGROUND_HEAD: "Color de fondo de la nota incrustada",
  ES_BACKGROUND_DESC_INFO: "Haz click aquí para más información sobre los colores",
  ES_BACKGROUND_DESC_DETAIL: "El color de fondo afecta solo al modo de vista previa del incrustado de Markdown. Al editar, sigue el tema claro/oscuro de Obsidian, según lo establecido para la escena (a través de la propiedad del documento) o en la configuración del plugin. El color de fondo tiene dos capas: el color de fondo del elemento (capa inferior) y un color encima (capa superior). Seleccionar 'Coincidir con el color de fondo del elemento' significa que ambas capas siguen el color del elemento. Seleccionar 'Coincidir con el lienzo' o un color de fondo específico mantiene la capa de fondo del elemento. Establecer la opacidad (ej., 50%) mezcla el lienzo o el color seleccionado con el color de fondo del elemento. Para eliminar la capa de fondo del elemento, establece el color del elemento en transparente en el editor de propiedades de Excalidraw. Esto hace que solo la capa superior sea efectiva.",
  ES_BACKGROUND_MATCH_ELEMENT: "Coincidir con el color de fondo del elemento",
  ES_BACKGROUND_MATCH_CANVAS: "Coincidir con el color de fondo del lienzo",
  ES_BACKGROUND_COLOR: "Color de fondo",
  ES_BORDER_HEAD: "Color del borde de la nota incrustada",
  ES_BORDER_COLOR: "Color del borde",
  ES_BORDER_MATCH_ELEMENT: "Coincidir con el color del borde del elemento",
  ES_BACKGROUND_OPACITY: "Opacidad del fondo",
  ES_BORDER_OPACITY: "Opacidad del borde",
  ES_EMBEDDABLE_SETTINGS: "Configuración de incrustables de Markdown",
  ES_USE_OBSIDIAN_DEFAULTS: "Usar los valores predeterminados de Obsidian",
  ES_ZOOM_100_RELATIVE_DESC: "El botón ajustará la escala del elemento para que muestre el contenido al 100% en relación con el nivel de zoom actual de tu lienzo.",
  ES_ZOOM_100: "100% Relativo",

  //Prompts.ts
  PROMPT_FILE_DOES_NOT_EXIST: "El archivo no existe. ¿Quieres crearlo?",
  PROMPT_ERROR_NO_FILENAME: "Error: El nombre de archivo para un archivo nuevo no puede estar vacío",
  PROMPT_ERROR_DRAWING_CLOSED: "Error desconocido. Parece que tu bosquejo se cerró o el archivo no se encuentra.",
  PROMPT_TITLE_NEW_FILE: "Nuevo Archivo",
  PROMPT_TITLE_CONFIRMATION: "Confirmación",
  PROMPT_BUTTON_CREATE_EXCALIDRAW: "Crear EX",
  PROMPT_BUTTON_CREATE_EXCALIDRAW_ARIA: "Crear bosquejo de Excalidraw y abrir en una nueva pestaña",
  PROMPT_BUTTON_CREATE_MARKDOWN: "Crear MD",
  PROMPT_BUTTON_CREATE_MARKDOWN_ARIA: "Crear documento de Markdown y abrir en una nueva pestaña",
  PROMPT_BUTTON_EMBED_MARKDOWN: "Incrustar MD",
  PROMPT_BUTTON_EMBED_MARKDOWN_ARIA: "Reemplazar el elemento seleccionado con un documento de Markdown incrustado",
  PROMPT_BUTTON_NEVERMIND: "No importa",
  PROMPT_BUTTON_OK: "OK",
  PROMPT_BUTTON_CANCEL: "Cancelar",
  PROMPT_BUTTON_INSERT_LINE: "Insertar nueva línea",
  PROMPT_BUTTON_INSERT_SPACE: "Insertar espacio",
  PROMPT_BUTTON_INSERT_LINK: "Insertar enlace Markdown a un archivo",
  PROMPT_BUTTON_UPPERCASE: "Mayúsculas",
  PROMPT_BUTTON_SPECIAL_CHARS: "Carácteres especiales",
  PROMPT_SELECT_TEMPLATE: "Selecciona una plantilla",

  //ModifierKeySettings
  WEB_BROWSER_DRAG_ACTION: "Web Browser Drag Action",
  LOCAL_FILE_DRAG_ACTION: "OS Local File Drag Action",
  INTERNAL_DRAG_ACTION: "Obsidian Internal Drag Action",
  PANE_TARGET: "Link click behavior",
  DEFAULT_ACTION_DESC: "In case none of the combinations apply the default action for this group is: ",

  //FrameSettings.ts
  FRAME_SETTINGS_TITLE: "Frame Settings",
  FRAME_SETTINGS_ENABLE: "Enable Frames",
  FRAME_SETTIGNS_NAME: "Display Frame Name",
  FRAME_SETTINGS_OUTLINE: "Display Frame Outline",
  FRAME_SETTINGS_CLIP: "Enable Frame Clipping",

  //InsertPDFModal.ts
  IPM_PAGES_TO_IMPORT_NAME: "Pages to import",
  IPM_SELECT_PAGES_TO_IMPORT: "Please select pages to import",
  IPM_ADD_BORDER_BOX_NAME: "Add border box",
  IPM_ADD_FRAME_NAME: "Add page to frame",
  IPM_ADD_FRAME_DESC: "For easier handling I recommend to lock the page inside the frame. " +
    "If, however, you do lock the page inside the frame then the only way to unlock it is to right-click the frame, select remove elements from frame, then unlock the page.",
  IPM_GROUP_PAGES_NAME: "Group pages",
  IPM_GROUP_PAGES_DESC: "This will group all pages into a single group. This is recommended if you are locking the pages after import, because the group will be easier to unlock later rather than unlocking one by one.",
  IPM_SELECT_PDF: "Please select a PDF file",

  //Utils.ts
  UPDATE_AVAILABLE: `A newer version of Excalidraw is available in Community Plugins.\n\nYou are using ${PLUGIN_VERSION}.\nThe latest is`,
  SCRIPT_UPDATES_AVAILABLE: `Script updates available - check the script store.\n\n${DEVICE.isDesktop ? `This message is available in console.log (${DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i"})\n\n` : ""}If you have organized scripts into subfolders under the script store folder and have multiple copies of the same script, you may need to clean up unused versions to clear this alert. For private copies of scripts that should not be updated, store them outside the script store folder.`,
  ERROR_PNG_TOO_LARGE: "Error exporting PNG - PNG too large, try a smaller resolution",

  //modifierkeyHelper.ts
  // WebBrowserDragAction
  WEB_DRAG_IMPORT_IMAGE: "Import Image to Vault",
  WEB_DRAG_IMAGE_URL: "Insert Image or YouTube Thumbnail with URL",
  WEB_DRAG_LINK: "Insert Link", 
  WEB_DRAG_EMBEDDABLE: "Insert Interactive-Frame",

  // LocalFileDragAction
  LOCAL_DRAG_IMPORT: "Import external file or reuse existing file if path is from the Vault",
  LOCAL_DRAG_IMAGE: "Insert Image: with local URI or internal-link if from Vault",
  LOCAL_DRAG_LINK: "Insert Link: local URI or internal-link if from Vault",
  LOCAL_DRAG_EMBEDDABLE: "Insert Interactive-Frame: local URI or internal-link if from Vault",

  // InternalDragAction  
  INTERNAL_DRAG_IMAGE: "Insert Image",
  INTERNAL_DRAG_IMAGE_FULL: "Insert Image @100%",
  INTERNAL_DRAG_LINK: "Insert Link",
  INTERNAL_DRAG_EMBEDDABLE: "Insert Interactive-Frame",

  // LinkClickAction
  LINK_CLICK_ACTIVE: "Open in current active window",
  LINK_CLICK_NEW_PANE: "Open in a new adjacent window",
  LINK_CLICK_POPOUT: "Open in a popout window",
  LINK_CLICK_NEW_TAB: "Open in a new tab",
  LINK_CLICK_MD_PROPS: "Show the Markdown image-properties dialog (only relevant if you have embedded a markdown document as an image)",

  //ExportDialog
  // Dialog and tabs
  EXPORTDIALOG_TITLE: "Export Drawing",
  EXPORTDIALOG_TAB_IMAGE: "Image",
  EXPORTDIALOG_TAB_PDF: "PDF",
  // Settings persistence
  EXPORTDIALOG_SAVE_SETTINGS: "Save image settings to file doc.properties?",
  EXPORTDIALOG_SAVE_SETTINGS_SAVE: "Save as preset",
  EXPORTDIALOG_SAVE_SETTINGS_ONETIME: "One-time use",
  // Image settings
  EXPORTDIALOG_IMAGE_SETTINGS: "Image",
  EXPORTDIALOG_IMAGE_DESC: "PNG supports transparency. External files can include Excalidraw scene data.",
  EXPORTDIALOG_PADDING: "Padding",
  EXPORTDIALOG_SCALE: "Scale",
  EXPORTDIALOG_CURRENT_PADDING: "Current padding:",
  EXPORTDIALOG_SIZE_DESC: "Scale affects output size",
  EXPORTDIALOG_SCALE_VALUE: "Scale:",
  EXPORTDIALOG_IMAGE_SIZE: "Size:",
  // Theme and background
  EXPORTDIALOG_EXPORT_THEME: "Theme",
  EXPORTDIALOG_THEME_LIGHT: "Light",
  EXPORTDIALOG_THEME_DARK: "Dark",
  EXPORTDIALOG_BACKGROUND: "Background",
  EXPORTDIALOG_BACKGROUND_TRANSPARENT: "Transparent",
  EXPORTDIALOG_BACKGROUND_USE_COLOR: "Use scene color",
  // Selection
  EXPORTDIALOG_SELECTED_ELEMENTS: "Export",
  EXPORTDIALOG_SELECTED_ALL: "Entire scene",
  EXPORTDIALOG_SELECTED_SELECTED: "Selection only",
  // Export options
  EXPORTDIALOG_EMBED_SCENE: "Include scene data?",
  EXPORTDIALOG_EMBED_YES: "Yes",
  EXPORTDIALOG_EMBED_NO: "No",
  // PDF settings
  EXPORTDIALOG_PDF_SETTINGS: "PDF",
  EXPORTDIALOG_PAGE_SIZE: "Size",
  EXPORTDIALOG_PAGE_ORIENTATION: "Orientation",
  EXPORTDIALOG_ORIENTATION_PORTRAIT: "Portrait",
  EXPORTDIALOG_ORIENTATION_LANDSCAPE: "Landscape",
  EXPORTDIALOG_PDF_FIT_TO_PAGE: "Page Fitting",
  EXPORTDIALOG_PDF_FIT_OPTION: "Fit to page",
  EXPORTDIALOG_PDF_FIT_2_OPTION: "Fit to max 2-pages",
  EXPORTDIALOG_PDF_FIT_4_OPTION: "Fit to max 4-pages",
  EXPORTDIALOG_PDF_FIT_6_OPTION: "Fit to max 6-pages",
  EXPORTDIALOG_PDF_FIT_8_OPTION: "Fit to max 8-pages",
  EXPORTDIALOG_PDF_FIT_12_OPTION: "Fit to max 12-pages",
  EXPORTDIALOG_PDF_FIT_16_OPTION: "Fit to max 16-pages",
  EXPORTDIALOG_PDF_SCALE_OPTION: "Use image scale (may span multiple pages)",
  EXPORTDIALOG_PDF_PAPER_COLOR: "Paper Color",
  EXPORTDIALOG_PDF_PAPER_WHITE: "White",
  EXPORTDIALOG_PDF_PAPER_SCENE: "Use scene color",
  EXPORTDIALOG_PDF_PAPER_CUSTOM: "Custom color",
  EXPORTDIALOG_PDF_ALIGNMENT: "Position on Page",
  EXPORTDIALOG_PDF_ALIGN_CENTER: "Center",
  EXPORTDIALOG_PDF_ALIGN_CENTER_LEFT: "Center Left",
  EXPORTDIALOG_PDF_ALIGN_CENTER_RIGHT: "Center Right",
  EXPORTDIALOG_PDF_ALIGN_TOP_LEFT: "Top Left",
  EXPORTDIALOG_PDF_ALIGN_TOP_CENTER: "Top Center", 
  EXPORTDIALOG_PDF_ALIGN_TOP_RIGHT: "Top Right",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_LEFT: "Bottom Left",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_CENTER: "Bottom Center",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_RIGHT: "Bottom Right",
  EXPORTDIALOG_PDF_MARGIN: "Margin",
  EXPORTDIALOG_PDF_MARGIN_NONE: "None",
  EXPORTDIALOG_PDF_MARGIN_TINY: "Small",
  EXPORTDIALOG_PDF_MARGIN_NORMAL: "Normal",
  EXPORTDIALOG_SAVE_PDF_SETTINGS: "Save PDF settings",
  EXPORTDIALOG_SAVE_CONFIRMATION: "PDF config saved to plugin settings as default",
  // Buttons
  EXPORTDIALOG_PNGTOFILE : "Export PNG",
  EXPORTDIALOG_SVGTOFILE : "Export SVG",
  EXPORTDIALOG_PNGTOVAULT : "PNG to Vault",
  EXPORTDIALOG_SVGTOVAULT : "SVG to Vault",
  EXPORTDIALOG_EXCALIDRAW: "Excalidraw",
  EXPORTDIALOG_PNGTOCLIPBOARD : "PNG to Clipboard",
  EXPORTDIALOG_SVGTOCLIPBOARD : "SVG to Clipboard",
  EXPORTDIALOG_PDF: "Export PDF",

  EXPORTDIALOG_PDF_PROGRESS_NOTICE: "Exporting PDF. If this image is large, it may take a while.",
  EXPORTDIALOG_PDF_PROGRESS_DONE: "Export complete",
  EXPORTDIALOG_PDF_PROGRESS_ERROR: "Error exporting PDF, check developer console for details",

  // Screenshot tab
  EXPORTDIALOG_NOT_AVAILALBE: "Sorry, this feature is only available when the drawing is open in the main Obsidian workspace.",
  EXPORTDIALOG_TAB_SCREENSHOT: "Screenshot",
  EXPORTDIALOG_SCREENSHOT_DESC: "Screenshots will include embeddables such as markdown pages, YouTube, websites, etc. They are only available on desktop, cannot be automatically exported, and only support PNG format.",
  SCREENSHOT_DESKTOP_ONLY: "Screenshot feature is only available on desktop",
  SCREENSHOT_FILE_SUCCESS: "Screenshot saved to vault",
  SCREENSHOT_CLIPBOARD_SUCCESS: "Screenshot copied to clipboard",
  SCREENSHOT_CLIPBOARD_ERROR: "Failed to copy screenshot to clipboard: ",
  SCREENSHOT_ERROR: "Error capturing screenshot - see console log",

  //exportUtils.ts
  PDF_EXPORT_DESKTOP_ONLY: "PDF export is only available on desktop",
};
