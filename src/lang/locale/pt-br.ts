import { DEVICE, FRONTMATTER_KEYS, CJK_FONTS } from "src/constants/constants";
import {
  TAG_AUTOEXPORT,
  TAG_MDREADINGMODE,
  TAG_PDFEXPORT,
} from "src/constants/constSettingsTags";
import { URLs } from "src/constants/safeUrls";
import {
  labelALT,
  labelCTRL,
  labelMETA,
  labelSHIFT,
} from "src/utils/modifierKeyLabels";

declare const PLUGIN_VERSION: string;

// Português do Brasil
// Brazilian Portuguese
export default {
  INITIALIZATION_MESSAGE:
    "O Excalidraw está aguardando o Obsidian inicializar todos os seus plugins...",
  SELECT_FILE_TO_INSERT: "Selecione um arquivo para inserir",
  ERROR_INITIALIZING_EA: "Erro ao inicializar o Excalidraw Automate",
  SETTINGS_DATA_INVALID:
    "O Excalidraw está aguardando um data.json de substituição válido. Alterações de configuração não serão salvas até o arquivo ser restaurado, ou você reiniciar o Obsidian e escolher Redefinir para padrões.",
  SETTINGS_DATA_REPAIRED_FROM_MEMORY:
    "Um arquivo de configurações do Excalidraw vazio ou ilegível foi recebido e rejeitado. As configurações ativas foram regravadas para reparar o data.json.",
  SETTINGS_DATA_RECOVERED:
    "O data.json do Excalidraw estava vazio ou ilegível. As últimas configurações válidas foram restauradas automaticamente.",
  SETTINGS_RECOVERY_MISSING_TITLE:
    "O arquivo de configurações do Excalidraw está ausente",
  SETTINGS_RECOVERY_MISSING_DESC:
    "Existe um backup de configurações válido neste dispositivo. Restaure esse backup ou redefina o Excalidraw para os padrões de fábrica. Fechar esta mensagem restaura o backup.",
  SETTINGS_RECOVERY_CORRUPT_TITLE:
    "O arquivo de configurações do Excalidraw está corrompido",
  SETTINGS_RECOVERY_CORRUPT_DESC:
    "O arquivo de configurações está vazio ou ilegível, e não há backup de recuperação neste dispositivo. Redefina o Excalidraw para os padrões de fábrica ou deixe o arquivo inalterado enquanto restaura um data.json válido de outra fonte. Fechar esta mensagem aguarda um arquivo de substituição.",
  SETTINGS_RECOVERY_RESTORE_BACKUP: "Restaurar backup",
  SETTINGS_RECOVERY_RESET_DEFAULTS: "Restaurar padrões",
  SETTINGS_RECOVERY_WAIT_FOR_FILE: "Aguardar arquivo restaurado",
  CONVERT_URL_TO_FILE: "Salvar imagem de URL em arquivo local",
  UNZIP_CURRENT_FILE: "Descomprimir arquivo Excalidraw atual",
  PUBLISH_SVG_CHECK:
    "Obsidian Publish: localizar exports SVG e PNG desatualizados",
  EMBEDDABLE_PROPERTIES: "Propriedades do embutível",
  EMBEDDABLE_RELATIVE_ZOOM:
    "Dimensionar elementos embutíveis selecionados para 100% em relação ao zoom atual do canvas",
  OPEN_IMAGE_SOURCE: "Abrir desenho do Excalidraw",
  OPEN_AS_EXCALIDRAW: "Abrir como Desenho do Excalidraw",
  TOGGLE_MODE: "Alternar entre modo Excalidraw e Markdown",
  DUPLICATE_IMAGE: "Duplicar imagem selecionada com um ID de imagem diferente",
  CONVERT_NOTE_TO_EXCALIDRAW:
    "Converter nota markdown em Desenho do Excalidraw",
  CONVERT_EXCALIDRAW: "Converter arquivos *.excalidraw em *.md",
  CREATE_NEW: "Novo desenho",
  CONVERT_FILE_KEEP_EXT: "*.excalidraw => *.excalidraw.md",
  CONVERT_FILE_REPLACE_EXT: "*.excalidraw => *.md (compatibilidade com Logseq)",
  DOWNLOAD_LIBRARY:
    "Exportar biblioteca de estêncils como arquivo *.excalidrawlib",
  LIBRARY_MIGRATION_TITLE:
    "Mover sua biblioteca do Excalidraw para dentro do vault",
  LIBRARY_MIGRATION_DESC:
    "O Excalidraw pode armazenar sua biblioteca num arquivo dedicado do vault em vez do data.json. Mantém as configurações menores e o salvamento mais estável. Seus itens serão mesclados no arquivo de biblioteca local; arquivos *.excalidrawlib baixados na mesma pasta também serão carregados. Escolha Depois para ocultar esta mensagem até amanhã.",
  LIBRARY_MIGRATION_SYNC_WARNING:
    'Para sincronizar arquivos de biblioteca com o Obsidian Sync, ative "Sincronizar todos os outros tipos" nas configurações do Obsidian Sync.',
  LIBRARY_MIGRATION_KEEP_DATA_JSON: "Continuar usando data.json",
  LIBRARY_MIGRATION_LATER: "Mais tarde",
  LIBRARY_MIGRATION_MIGRATE: "Mover biblioteca",
  LIBRARY_MIGRATION_SUCCESS:
    "Biblioteca do Excalidraw movida para dentro do vault.",
  LIBRARY_MIGRATION_FAILED:
    "Não foi possível mover a biblioteca. Sua biblioteca original em data.json foi mantida inalterada.",
  LIBRARY_FILE_READ_ERROR:
    "Não foi possível ler o arquivo de biblioteca do Excalidraw: {PATH}",
  LIBRARY_STORAGE_NAME: "Armazenamento da biblioteca",
  LIBRARY_STORAGE_DESC:
    "Arquivos do vault fornecem salvamento mais estável porque a biblioteca de estêncis fica fora do data.json.",
  LIBRARY_STORAGE_VAULT: "Pasta do vault (recomendado)",
  LIBRARY_STORAGE_DATA_JSON: "data.json do plugin (legado)",
  LIBRARY_FOLDER_NAME: "Pasta da biblioteca",
  LIBRARY_FOLDER_DESC:
    'Pasta para local-library.excalidrawlib e arquivos de biblioteca baixados. Arquivos de biblioteca usam a extensão .excalidrawlib. Para vê-los no explorador de arquivos do Obsidian, ative "Mostrar todos os tipos de arquivo" nas configurações do Obsidian.',
  LIBRARY_FILE_NAME: "Nome do arquivo de biblioteca local",
  LIBRARY_FILE_DESC:
    "Nome do arquivo de biblioteca local editável. A extensão .excalidrawlib é adicionada automaticamente.",
  LIBRARY_MIGRATE_NOW: "Mover biblioteca agora",
  LIBRARY_MIGRATE_NOW_DESC:
    "Move a biblioteca data.json existente para o arquivo do vault configurado.",
  LIBRARY_PATH_MISSING: "Este caminho não existe atualmente no vault.",
  CREATE_FOLDER: "Criar pasta",
  CREATE_FOLDER_CONFIRM: "Deseja criar a pasta <b>{PATH}</b>?",
  CREATE_FOLDER_NEVER_MIND: "Deixa pra lá",
  CREATE_FOLDER_YES: "Sim",
  CREATE_FOLDER_SUCCESS: "Pasta criada: {PATH}",
  CREATE_FOLDER_FAILED: "Não foi possível criar a pasta: {PATH}",
  CREATE_FOLDER_PATH_IS_FILE:
    "A pasta não pode ser criada porque já existe um arquivo em: {PATH}",
  OPEN_SIDEPANEL: "Abrir painel lateral do Excalidraw",
  OPEN_EXISTING_NEW_PANE: "Abrir desenho existente - EM UM NOVO PAINEL",
  OPEN_EXISTING_ACTIVE_PANE: "Abrir desenho existente - NO PAINEL ATIVO ATUAL",
  TRANSCLUDE: "Embutir um desenho",
  TRANSCLUDE_MOST_RECENT: "Embutir o desenho editado mais recentemente",
  TOGGLE_LEFTHANDED_MODE: "Alternar modo canhoto",
  TOGGLE_SPLASHSCREEN: "Mostrar tela de abertura em novos desenhos",
  FLIP_IMAGE:
    "Abrir o verso da nota da imagem selecionada em janela flutuante (virar a carta)",
  NEW_IN_NEW_PANE: "Criar novo desenho - EM UMA JANELA ADJACENTE",
  NEW_IN_NEW_TAB: "Criar novo desenho - EM UMA NOVA ABA",
  NEW_IN_ACTIVE_PANE: "Criar novo desenho - NA JANELA ATIVA ATUAL",
  NEW_IN_POPOUT_WINDOW: "Criar novo desenho - EM UMA JANELA FLUTUANTE",
  NEW_IN_NEW_PANE_EMBED:
    "Criar novo desenho - EM UMA JANELA ADJACENTE - e embutir no documento ativo",
  NEW_IN_NEW_TAB_EMBED:
    "Criar novo desenho - EM UMA NOVA ABA - e embutir no documento ativo",
  NEW_IN_ACTIVE_PANE_EMBED:
    "Criar novo desenho - NA JANELA ATIVA ATUAL - e embutir no documento ativo",
  NEW_IN_POPOUT_WINDOW_EMBED:
    "Criar novo desenho - EM UMA JANELA FLUTUANTE - e embutir no documento ativo",
  TOGGLE_LOCK:
    "Alternar elemento de texto entre edição BRUTO e PRÉ-VISUALIZAÇÃO",
  DELETE_FILE:
    "Excluir imagem ou arquivo Markdown selecionado do vault do Obsidian",
  DELETE_IMAGE_NOTICE: "Selecione uma imagem ou documento markdown embutido",
  MARKER_FRAME_SHOW: "Frames de marcador visíveis",
  MARKER_FRAME_TITLE_SHOW: "Títulos dos frames de marcador visíveis",
  COPY_ELEMENT_LINK: "Copiar [[link]] dos elementos selecionados",
  FRAME_WITH_NAME: "Copiar link do frame por nome",
  COPY_DRAWING_LINK: "Copiar ![[embed link]] deste desenho",
  INSERT_LINK_TO_ELEMENT: `Copiar [[link]] do elemento selecionado para a área de transferência. ${labelCTRL()}+CLIQUE para copiar link 'group='. ${labelSHIFT()}+CLIQUE para copiar um link 'area='.`,
  INSERT_LINK_TO_ELEMENT_GROUP:
    "Copiar ![[link]] com 'group=' do elemento selecionado para a área de transferência.",
  INSERT_LINK_TO_ELEMENT_AREA:
    "Copiar ![[link]] com 'area=' do elemento selecionado para a área de transferência.",
  INSERT_LINK_TO_ELEMENT_FRAME:
    "Copiar ![[link]] com 'frame=' do elemento selecionado para a área de transferência.",
  INSERT_LINK_TO_ELEMENT_FRAME_CLIPPED:
    "Copiar ![[link]] com 'clippedframe=' do elemento selecionado para a área de transferência.",
  INSERT_LINK_TO_ELEMENT_NORMAL:
    "Copiar [[link]] do elemento selecionado para a área de transferência.",
  INSERT_LINK_TO_ELEMENT_ERROR: "Selecione um único elemento na cena",
  INSERT_LINK_TO_ELEMENT_READY:
    "Link PRONTO e disponível na área de transferência",
  INSERT_LINK: "Inserir link para arquivo",
  INSERT_COMMAND: "Inserir comando do Obsidian como link",
  INSERT_IMAGE: "Inserir imagem ou desenho do Excalidraw do seu vault",
  IMPORT_SVG:
    "Importar arquivo SVG como traços do Excalidraw (suporte limitado a SVG, TEXTO não é suportado atualmente)",
  IMPORT_SVG_CONTEXTMENU: "Converter SVG em traços - com limitações",
  INSERT_MD: "Inserir arquivo markdown do vault",
  INSERT_MARKDOWN_IMAGE: "Inserir imagem Markdown editável",
  EDIT_MARKDOWN_IMAGE: "Editar imagem Markdown",
  MARKDOWN_IMAGE_SELECT_ERROR:
    "Selecione uma imagem Markdown e tente novamente",
  MARKDOWN_IMAGE_TITLE: "Imagem Markdown",
  MARKDOWN_IMAGE_INSERT_ERROR: "Não foi possível inserir a imagem Markdown",
  MARKDOWN_IMAGE_APPEARANCE: "Aparência",
  MARKDOWN_IMAGE_WIDTH: "Largura",
  MARKDOWN_IMAGE_WIDTH_DESC:
    "Largura de fluxo do markdown em unidades do canvas",
  MARKDOWN_IMAGE_BOTTOM_PADDING: "Espaçamento inferior",
  MARKDOWN_IMAGE_BOTTOM_PADDING_DESC:
    "Espaço extra abaixo do markdown renderizado, em pixels",
  MARKDOWN_IMAGE_FONT: "Fonte",
  MARKDOWN_IMAGE_FONT_COLOR: "Cor da fonte",
  MARKDOWN_IMAGE_BORDER: "Borda",
  MARKDOWN_IMAGE_BORDER_COLOR: "Cor da borda",
  MARKDOWN_IMAGE_CSS: "CSS",
  MARKDOWN_IMAGE_CSS_DESC:
    "CSS apenas para esta imagem Markdown. Copie o SVG abaixo e peça ao seu LLM preferido o CSS de que precisa.",
  MARKDOWN_IMAGE_CSS_IMPORTANT_HINT:
    "Se uma regra não surtir efeito, adicione !important à declaração.",
  MARKDOWN_IMAGE_CSS_EDITOR_ARIA: "Editor de CSS desta imagem Markdown",
  MARKDOWN_IMAGE_TRANSCLUSION_CSS_EDITOR_ARIA:
    "Editor de CSS do Markdown embutido",
  MARKDOWN_IMAGE_INSERT_CSS_BOILERPLATE:
    "Inserir um boilerplate de CSS comentado",
  MARKDOWN_IMAGE_COPY_SVG: "Copiar o SVG da imagem Markdown atual",
  MARKDOWN_IMAGE_SVG_COPIED: "SVG da imagem Markdown copiado",
  MARKDOWN_IMAGE_SVG_COPY_ERROR:
    "Não foi possível copiar o SVG da imagem Markdown",
  MARKDOWN_IMAGE_TRANSCLUSION_DIFFERENT_STYLE:
    "Usar estilo diferente para transclusões",
  MARKDOWN_IMAGE_TRANSCLUSION_DIFFERENT_STYLE_DESC:
    "Mostrar configurações de aparência separadas para o Markdown transcluído.",
  MARKDOWN_IMAGE_TRANSCLUSION_APPEARANCE: "Aparência da transclusão",
  MARKDOWN_IMAGE_TRANSCLUSION_APPEARANCE_DESC:
    "Quando ativado, estas configurações se aplicam a ![[transcluded text]] dentro desta imagem Markdown.",
  MARKDOWN_IMAGE_TRANSCLUSION_CSS: "CSS da transclusão",
  MARKDOWN_IMAGE_TRANSCLUSION_CSS_DESC:
    "Regras CSS aplicadas apenas ao Markdown transcluído.",
  MARKDOWN_IMAGE_SET_DEFAULT: "Definir como padrão",
  MARKDOWN_IMAGE_SAVE_DEFAULT_ARIA:
    "Salvar configurações de aparência atuais como padrão",
  MARKDOWN_IMAGE_DEFAULT_SAVED: "Padrões de imagem Markdown salvos",
  MARKDOWN_IMAGE_RENDER_NOW: "Renderizar agora",
  MARKDOWN_IMAGE_UPDATING: "Atualizando imagem…",
  MARKDOWN_IMAGE_EXTERNAL_SOURCE: "Fonte Markdown externa",
  MARKDOWN_IMAGE_OPEN_EXTERNAL_SOURCE_NEW_TAB:
    "Abrir fonte Markdown externa em uma nova aba",
  MARKDOWN_IMAGE_MAKE_LOCAL: "Criar cópia local",
  MARKDOWN_IMAGE_EXTERNAL_TARGET: "Nota, título ou bloco externo",
  MARKDOWN_IMAGE_EXTERNAL_DESC:
    "Digite um link do Obsidian para usar uma fonte externa",
  MARKDOWN_IMAGE_USE_SOURCE: "Usar fonte",
  MARKDOWN_IMAGE_EXTRACT_LOCAL: "Extrair Markdown local para uma nota",
  MARKDOWN_IMAGE_EXTRACT: "Extrair para nota",
  MARKDOWN_IMAGE_DUPLICATE_ERROR: "Não foi possível duplicar a imagem Markdown",
  MARKDOWN_IMAGE_SELECT_SOURCE: "Selecione uma nota, título ou bloco Markdown",
  MARKDOWN_IMAGE_CHANGE_SOURCE_ERROR:
    "Não foi possível alterar a fonte da imagem Markdown",
  MARKDOWN_IMAGE_LOCAL_COPY_ERROR:
    "Não foi possível criar uma cópia Markdown local",
  MARKDOWN_IMAGE_EXTRACT_TITLE: "Extrair imagem Markdown para nota",
  FILE_AND_FOLDER_SELECTOR_FOLDER: "Pasta",
  FILE_AND_FOLDER_SELECTOR_FILENAME: "Nome do arquivo",
  FILE_AND_FOLDER_SELECTOR_EXPORT_TITLE: "Exportar para o Vault",
  FILE_AND_FOLDER_SELECTOR_EXPORT: "Exportar",
  MARKDOWN_IMAGE_DEFAULT_NOTE: "Imagem markdown.md",
  MARKDOWN_IMAGE_CREATE_NOTE_ERROR: "Não foi possível criar a nota Markdown",
  MARKDOWN_IMAGE_UNKNOWN_ERROR: "Erro desconhecido",
  MARKDOWN_IMAGE_SOURCE_UNAVAILABLE:
    "A fonte da imagem Markdown está indisponível.",
  MARKDOWN_IMAGE_RESERVED_MARKER:
    "O corpo do Markdown contém uma linha marcadora reservada de imagem Markdown.",
  MARKDOWN_IMAGE_EMPTY_PLACEHOLDER:
    "Comece a digitar no editor de imagem Markdown…",
  MARKDOWN_IMAGE_NO_SELECTION: "Selecione uma imagem Markdown para editá-la.",
  MARKDOWN_IMAGE_ATTACHED_TO: "Anexada a {file}",
  MARKDOWN_IMAGE_FOCUS_OWNER: "Focar documento Excalidraw proprietário: {file}",
  MARKDOWN_IMAGE_OWNER_UNAVAILABLE:
    "O documento Excalidraw proprietário não está mais disponível.",
  MARKDOWN_IMAGE_RESIZE_EDITOR: "Redimensionar editor Markdown",
  CONVERT_EMBEDDABLE_TO_MARKDOWN_IMAGE: "Converter em imagem Markdown",
  CONVERT_MARKDOWN_IMAGE_TO_EMBEDDABLE: "Converter em embutível",
  MARKDOWN_IMAGE_CONVERSION_ERROR:
    "Não foi possível converter o conteúdo Markdown.",
  MARKDOWN_IMAGE_H1_WARNING:
    "Uma imagem Markdown local pode conter apenas um cabeçalho de nível 1 ao ser convertida em embutível. Ele deve ser o primeiro conteúdo e seu nome deve ser único no desenho.",
  MARKDOWN_IMAGE_SECTION_NAME: "Nomear a seção do verso da nota",
  MARKDOWN_IMAGE_SECTION_NAME_PLACEHOLDER: "Digite um nome de seção único",
  MARKDOWN_IMAGE_DELETE_TEXT_PROMPT:
    "Excluir o texto markdown armazenado para esta imagem? A imagem será removida da cena de qualquer forma.",
  MARKDOWN_IMAGE_KEEP_TEXT: "Manter texto Markdown",
  MARKDOWN_IMAGE_DELETE_TEXT: "Excluir texto Markdown",
  MARKDOWN_IMAGE_REMEMBER_DELETE_CHOICE:
    "Usar esta escolha para exclusões futuras",
  MARKDOWN_IMAGE_REMEMBER_DELETE_CHOICE_DESC:
    'Redefinir "Exclusão de imagem Markdown local" para "Perguntar toda vez" nas configurações do plugin Excalidraw.',
  MARKDOWN_IMAGE_DELETE_BEHAVIOR_NAME: "Exclusão de imagem Markdown local",
  MARKDOWN_IMAGE_DELETE_BEHAVIOR_DESC:
    "Escolha se excluir uma imagem Markdown local também exclui seu texto markdown do verso-da-nota.",
  MARKDOWN_IMAGE_DELETE_BEHAVIOR_ASK: "Perguntar toda vez",
  MARKDOWN_IMAGE_DELETE_BEHAVIOR_KEEP: "Manter texto sem perguntar",
  MARKDOWN_IMAGE_DELETE_BEHAVIOR_DELETE: "Excluir texto sem perguntar",
  INSERT_PDF: "Inserir arquivo PDF do vault",
  INSERT_LAST_ACTIVE_PDF_PAGE_AS_IMAGE:
    "Inserir última página PDF ativa como imagem",
  UNIVERSAL_ADD_FILE: "Inserir QUALQUER arquivo",
  ABOUT_LIBRARIES: "Como carregar bibliotecas",
  INSERT_CARD: "Adicionar carta de verso-de-nota",
  COMP_IMG: "Imagem & Arquivos",
  COMP_IMG_FROM_SYSTEM: "Importar do sistema",
  COMP_IMG_ANY_FILE: "QUALQUER arquivo do Vault",
  COMP_IMG_LaTeX: "Fórmula LaTeX",
  COMP_FRAME: "Ações de Frame",
  COMP_FRAME_HINT:
    "Alternar Quadro de Marcador. Quadros apenas-guia para definir slides/áreas de impressão/referências de imagem. Ocultos nas exportações de imagem; não contêm elementos. Oculte/mostre quadros pelo menu de contexto do canvas.",
  CONVERT_CARD_TO_FILE: "Mover carta de verso-de-nota para arquivo",
  ERROR_TRY_AGAIN: "Tente novamente.",
  PASTE_CODEBLOCK: "Colar bloco de código",
  INVERT_IMAGES_IN_DARK_MODE: "Inverter imagem(ns) no modo escuro",
  INSERT_LATEX:
    "Inserir fórmula LaTeX (ex.: \\\\binom{n}{k} = \\\\frac{n!}{k!(n-k)!}).",
  ENTER_LATEX: "Digite uma expressão LaTeX válida",
  EDIT_LATEX: "Editar fórmula LaTeX",
  READ_RELEASE_NOTES: "Ler notas da versão mais recente",
  ABOUT_EXCALIDRAW: "Sobre o Excalidraw",
  RUN_OCR:
    "OCR do desenho completo: extrair texto de freedraw + imagens para a área de transferência e doc.props",
  TASKBONE_NOT_ENABLED:
    "O OCR do Taskbone não está ativado. Vá às configurações do plugin para ativá-lo.",
  OCR_ABORT_NO_ELEMENTS:
    "Abortando OCR porque não há elementos de imagem ou freedraw no canvas.",
  OCR_ALREADY_PROCESSED:
    "O desenho já foi processado; você encontrará o resultado no frontmatter no modo de visualização Markdown. Se executou o comando pelo painel do Obsidian no Excalidraw, pode ctrl(cmd)+clicar no comando para forçar o reescaneamento.",
  RERUN_OCR:
    "Reexecutar OCR do desenho completo: extrair texto de freedraw + imagens para a área de transferência e doc.props",
  RUN_OCR_ELEMENTS:
    "OCR dos elementos selecionados: extrair texto de freedraw + imagens para a área de transferência",
  UI_MODE: "Alternar modo de interface",
  SEARCH: "Procurar texto no desenho",
  CROP_PAGE: "Recortar e mascarar página selecionada",
  CROP_IMAGE: "Recortar e mascarar imagem",
  ANNOTATE_IMAGE: "Anotar imagem no Excalidraw",
  ANNOTATE_IMAGE_ERROR:
    "Arquivo não encontrado. O novo desenho do Excalidraw está demorando demais para ser criado. Tente novamente.",
  INSERT_ACTIVE_PDF_PAGE_AS_IMAGE: "Inserir página PDF ativa como imagem",
  RESET_IMG_TO_100:
    "Definir tamanho do elemento de imagem selecionado para 100% do original",
  RESET_IMG_ASPECT_RATIO:
    "Redefinir proporção do elemento de imagem selecionado",
  TEMPORARY_DISABLE_AUTOSAVE:
    "Desativar salvamento automático até o Obsidian reiniciar (só defina se souber o que está fazendo)",
  TEMPORARY_ENABLE_AUTOSAVE: "Ativar salvamento automático",
  TEMPORARY_TOGGLE_VIEW_MODE_FOR_ALL_DRAWINGS:
    "Alternar modo de visualização de todos os desenhos do Excalidraw até o Obsidian reiniciar",
  FONTS_LOADED: "Excalidraw: fontes CJK carregadas",
  FONTS_LOAD_ERROR:
    "Excalidraw: não foi possível encontrar fontes CJK na pasta de assets\\n",
  TOGGLE_ENABLE_CONTEXT_MENU:
    "Alternar menu de contexto (útil em dispositivos móveis)",
  SELECT_LINK_TO_OPEN: "Selecione um link para abrir",
  ERROR_CANT_READ_FILEPATH:
    "Erro, não é possível ler o caminho do arquivo. Importando o arquivo",
  NO_SEARCH_RESULT: "Nenhum elemento correspondente encontrado no desenho",
  FORCE_SAVE_ABORTED:
    "Salvamento forçado abortado porque um salvamento está em andamento",
  DRAWING_RELOAD_FAILED:
    "O Excalidraw rejeitou dados de Desenho inválidos recebidos. O desenho atualmente aberto no canvas foi preservado. Salve ou exporte-o antes de fechar esta visualização e revise o arquivo sincronizado ou seu histórico de versões.",
  LINKLIST_SECOND_ORDER_LINK: "Link de segunda ordem",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT_TITLE:
    "Personalizar o link do arquivo embutido",
  MARKDOWN_EMBED_CUSTOMIZE_LINK_PROMPT:
    "Não adicione [[square brackets]] ao redor do nome do arquivo!<br>Para imagens de página markdown, siga este formato ao editar seu link: <mark>filename#^blockref|WIDTHxMAXHEIGHT</mark><br>Você pode ancorar imagens Excalidraw a 100% do tamanho adicionando <code>|100%</code> ao final do link.<br>Mude a página do PDF alterando <code>#page=1</code> para <code>#page=2</code> etc.<br>Valores de recorte PDF: <code>left, bottom, right, top</code>. Ex.: <code>#rect=0,0,500,500</code><br>",
  FRAME_CLIPPING_ENABLED: "Renderização de frames: ativada",
  FRAME_CLIPPING_DISABLED: "Renderização de frames: desativada",
  ARROW_BINDING_INVERSE_MODE:
    "Modo invertido: a vinculação padrão de setas está desativada. Use CTRL/CMD para ativá-la temporariamente quando necessário.",
  ARROW_BINDING_NORMAL_MODE:
    "Modo normal: a vinculação de setas está ativada. Use CTRL/CMD para desativá-la temporariamente quando necessário.",
  WARNING_SERIOUS_ERROR:
    "AVISO: o Excalidraw encontrou um problema desconhecido!\\n\\nHá risco de suas mudanças mais recentes não serem salvas.\\n\\nPor segurança...\\n1) Selecione seu desenho com CTRL/CMD+A e copie com CTRL/CMD+C.\\n2) Crie um desenho vazio num novo painel com CTRL/CMD+clique no ícone do Excalidraw,\\n3) e cole seu trabalho no novo documento com CTRL/CMD+V.",
  ARIA_LABEL_TRAY_MODE:
    "Você pode escolher entre 3 modos de interface para desktop e tablet: Completo, Compacto e Bandeja. Em celulares, apenas o modo Celular está disponível.",
  TRAY_TRAY_MODE: "Alternar modo de interface",
  TRAY_SCRIPT_LIBRARY: "Biblioteca de Scripts",
  TRAY_SCRIPT_LIBRARY_ARIA: "Explorar a Biblioteca de Scripts do Excalidraw",
  TRAY_EXPORT: "Exportar imagem...",
  TRAY_EXPORT_ARIA: "Exportar imagem como PNG, SVG ou arquivo Excalidraw",
  TRAY_SAVE: "Salvar",
  TRAY_SWITCH_TO_MD: "Abrir como Markdown",
  TRAY_SWITCH_TO_MD_ARIA: "Alternar para visualização markdown",
  MASK_FILE_NOTICE:
    "Este é um arquivo de máscara. Ele é usado para recortar imagens e mascarar partes da imagem. Mantenha pressionado este aviso para abrir o vídeo de ajuda.",
  INSTALL_SCRIPT_BUTTON: "Instalar ou atualizar Scripts do Excalidraw",
  OPEN_AS_MD: "Abrir como Markdown",
  EXPORT_IMAGE: "Exportar imagem",
  SHOW_TAB_TITLEBAR_BUTTONS: "Mostrar botões na barra de título das abas",
  OPEN_LINK:
    "Abrir texto selecionado como link\\n(SHIFT+CLIQUE para abrir em um novo painel)",
  EXCALIDRAW_SIDEPANEL: "Painel lateral do Excalidraw",
  LINK_BUTTON_CLICK_NO_TEXT:
    "Selecione um elemento que contenha um link interno ou externo.\\n",
  LINEAR_ELEMENT_LINK_CLICK_ERROR: `Links de elementos de Seta e Linha não podem ser navegados com ${labelCTRL()} + CLIQUE no elemento, pois isso também ativa o editor de linhas.\nUse o menu de contexto do clique direito para abrir o link, ou clique no indicador de link no canto superior direito do elemento.\n`,
  FILENAME_INVALID_CHARS:
    'O nome do arquivo não pode conter nenhum destes caracteres: * " \\ < > : | ? #',
  FORCE_SAVE: "Salvar (também atualizará transclusões)",
  RAW: "Mudar para modo PRÉ-VISUALIZAÇÃO (afeta apenas elementos de texto com links ou transclusões)",
  PARSED:
    "Mudar para modo BRUTO (afeta apenas elementos de texto com links ou transclusões)",
  NOFILE: "Excalidraw (sem arquivo)",
  COMPATIBILITY_MODE:
    "Arquivo *.excalidraw aberto em modo de compatibilidade. Converta para o novo formato para funcionalidade completa do plugin.",
  CONVERT_FILE: "Converter para novo formato",
  BACKUP_AVAILABLE:
    "Encontramos um erro ao carregar seu desenho. Isto pode ter ocorrido se o Obsidian fechou inesperadamente durante um salvamento — por exemplo, se você fechou acidentalmente o Obsidian no celular enquanto salvava.<br><br><b>BOA NOTÍCIA:</b> felizmente, um backup local está disponível. Note, porém: se você modificou este desenho por último em outro dispositivo (ex.: tablet) e agora está no desktop, aquele dispositivo provavelmente tem um backup mais recente.<br><br>Recomendo tentar abrir o desenho no outro dispositivo primeiro e restaurar o backup do armazenamento local dele.<br><br>Deseja carregar o backup?",
  BACKUP_SAVE_AS_FILE:
    "Este desenho está vazio. Um backup não vazio está disponível. Deseja restaurá-lo como um novo arquivo e abri-lo em uma nova aba?",
  BACKUP_SAVE: "Restaurar",
  BACKUP_DELETE: "Excluir backup",
  BACKUP_CANCEL: "Cancelar",
  CACHE_NOT_READY:
    "Peço desculpas pela inconveniência, mas ocorreu um erro ao carregar seu arquivo.<br><br><mark>Um pouco de paciência pode lhe poupar muito tempo...</mark><br><br>O plugin tem um cache de backup, mas parece que você acabou de iniciar o Obsidian. Inicializar o Cache de Backup pode levar algum tempo, geralmente até um minuto ou mais, dependendo do desempenho do seu dispositivo. Você receberá uma notificação no canto superior direito quando a inicialização terminar.<br><br>Pressione OK para tentar carregar o arquivo novamente e verificar se o cache terminou de inicializar. Se vir um arquivo completamente vazio atrás desta mensagem, recomendo esperar até o cache estar pronto. Alternativamente, escolha Cancelar para corrigir manualmente seu arquivo.<br>",
  OBSIDIAN_TOOLS_PANEL: "Painel de ferramentas do Obsidian",
  ERROR_SAVING_IMAGE:
    "Erro desconhecido ao buscar a imagem. Pode ser que, por algum motivo, a imagem não esteja disponível ou tenha rejeitado a requisição do Obsidian",
  WARNING_PASTING_ELEMENT_AS_TEXT:
    "NÃO É PERMITIDO COLAR ELEMENTOS DO EXCALIDRAW COMO ELEMENTO DE TEXTO",
  USE_INSERT_FILE_MODAL:
    "Use 'Inserir qualquer arquivo' para embutir uma nota markdown",
  RECURSIVE_INSERT_ERROR:
    "Não é possível inserir recursivamente parte de uma imagem na mesma imagem, pois isso criaria um loop infinito",
  CONVERT_TO_MARKDOWN: "Converter em arquivo...",
  SELECT_TEXTELEMENT_ONLY:
    "Selecione apenas elemento de texto (não o contêiner)",
  REMOVE_LINK: "Remover link do elemento de texto",
  WELCOME_RANK_NEXT: "desenhos até o próximo rank!",
  WELCOME_RANK_LEGENDARY: "Você está no topo. Continue sendo lendário!",
  WELCOME_COMMAND_PALETTE: 'Digite "Excalidraw" na Paleta de Comandos',
  WELCOME_OBSIDIAN_MENU: "Explore o Menu do Obsidian no canto superior direito",
  WELCOME_SCRIPT_LIBRARY: "Visite a Biblioteca de Scripts",
  WELCOME_HELP_MENU: "Encontre ajuda no menu hamburguer",
  WELCOME_YOUTUBE_ARIA: "Canal Visual PKM no YouTube",
  WELCOME_YOUTUBE_LINK: "Confira o canal Visual PKM no YouTube.",
  WELCOME_SYM_ARIA: "Aprenda Excalidraw, domine o PKM, junte-se à comunidade",
  WELCOME_SYM_LINK: "Aprenda Excalidraw, domine o PKM, junte-se à comunidade",
  WELCOME_TWITTER_ARIA: "Siga-me no Twitter",
  WELCOME_TWITTER_LINK: "Siga-me no Twitter",
  WELCOME_DONATE_ARIA: "Doe para apoiar o Excalidraw-Obsidian",
  WELCOME_DONATE_LINK: 'Diga "Obrigado" & apoie o plugin.',
  SAVE_IS_TAKING_LONG:
    "O salvamento do arquivo anterior está demorando. Aguarde...",
  SAVE_IS_TAKING_VERY_LONG:
    "Para melhor desempenho, considere dividir desenhos grandes em vários arquivos menores.",
  SEARCH_COPIED_TO_CLIPBOARD: "Markdown pronto na área de transferência",
  SEARCH_COPY_TO_CLIPBOARD_ARIA:
    "Copiar todo o diálogo para a área de transferência como Markdown. Ideal para usar com ferramentas como ChatGPT para pesquisar e entender.",
  SEARCH_SHOWHIDE_ARIA: "Mostrar/ocultar barra de pesquisa",
  SEARCH_NEXT: "Próximo",
  SEARCH_PREVIOUS: "Anterior",
  SETTINGS_TOOLBAR_COPY: "Copiar configurações",
  SETTINGS_TOOLBAR_NOTEBOOKLM: "NotebookLM",
  SETTINGS_TOOLBAR_BUGS: "Bugs",
  SETTINGS_TOOLBAR_WIKI: "Wiki",
  SETTINGS_TOOLBAR_YOUTUBE: "YouTube",
  SETTINGS_TOOLBAR_LEARN: "Aprender",
  SETTINGS_TOOLBAR_FOLLOW: "Twitter",
  SETTINGS_TOOLBAR_READ: "Ler o livro",
  SETTINGS_TOOLBAR_KOFI: "Ko-fi",
  USE_DECLARATIVE_SETTINGS_NAME: "Usar configurações pesquisáveis",
  USE_DECLARATIVE_SETTINGS_DESC:
    "Usa a interface de configurações pesquisável e multipágina do Obsidian. Desative para usar as configurações legadas de página única do Excalidraw. Exige reiniciar o Obsidian.",
  FOLDER_PLACEHOLDER: "ex.: Excalidraw",
  CROP_FOLDER_PLACEHOLDER: "ex.: Excalidraw/Cropped",
  ANNOTATE_FOLDER_PLACEHOLDER: "ex.: Excalidraw/Annotations",
  TEMPLATE_PLACEHOLDER: "ex.: Excalidraw/Template",
  SCRIPT_FOLDER_PLACEHOLDER: "ex.: Excalidraw/Scripts",
  FILENAME_PREFIX_PLACEHOLDER: "ex.: Desenho ",
  CROP_PREFIX_PLACEHOLDER: "ex.: cropped_",
  CROP_SUFFIX_PLACEHOLDER: "ex.: _cropped",
  ANNOTATE_PREFIX_PLACEHOLDER: "ex.: annotated_",
  ANNOTATE_SUFFIX_PLACEHOLDER: "ex.: _annotated",
  DYNAMICSTYLE_OPTION_NONE: "Estilização dinâmica desativada",
  DYNAMICSTYLE_OPTION_COLORFUL: "Correspondente à cor",
  DYNAMICSTYLE_OPTION_GRAY: "Cinza, mesmo tom",
  DEFAULT_OPEN_MODE_OPTION_NORMAL: "Sempre em modo normal",
  DEFAULT_OPEN_MODE_OPTION_ZEN: "Sempre em modo zen",
  DEFAULT_OPEN_MODE_OPTION_VIEW: "Sempre em modo de visualização",
  DEFAULT_OPEN_MODE_OPTION_VIEW_MOBILE:
    "Normalmente normal, mas modo de visualização no celular",
  DEFAULT_PEN_MODE_OPTION_NEVER: "Nunca",
  DEFAULT_PEN_MODE_OPTION_MOBILE: "No Obsidian Mobile",
  DEFAULT_PEN_MODE_OPTION_ALWAYS: "Sempre",
  EMBED_PREVIEW_IMAGETYPE_OPTION_PNG: "Imagem PNG",
  EMBED_PREVIEW_IMAGETYPE_OPTION_SVG: "SVG nativo",
  EMBED_PREVIEW_IMAGETYPE_OPTION_SVGIMG: "Imagem SVG",
  DEFAULT_COLOR_MD_DESC: "Nome de cor CSS|RGB-HEX",
  MD_CSS_PLACEHOLDER: "Nome do arquivo CSS no vault",
  CJK_ASSETS_FOLDER_PLACEHOLDER: "ex.: Excalidraw/FontAssets",
  DISABLE_CONTEXT_MENU_NAME: "Desativar menu de contexto do Excalidraw",
  DISABLE_CONTEXT_MENU_DESC:
    "Desativa o menu de contexto do Excalidraw. Pode ser útil em dispositivos móveis, onde o menu de contexto aparece em momentos indesejados.",
  NOTEBOOKLM_LINK_ARIA:
    "Peça ajuda ao NotebookLM sobre o plugin. Este modelo foi pré-carregado com as transcrições dos meus vídeos, notas de versão e outros conteúdos úteis. Converse com o NotebookLM para explorar meus 250+ vídeos e a documentação do Excalidraw.",
  EXCALIDRAW_MASTERY: "Excalidraw Mastery",
  EXCALIDRAW_MASTERY_PROMO_ARIA: "Abrir Excalidraw Mastery",
  EXCALIDRAW_MASTERY_PROMO_HTML: `<p><b>Perdido entre os interruptores e menus?</b></p><p>O Excalidraw é uma potência de PKM Visual criada para fluxos pesados como <b>Notas Diárias Visual-First</b>, <b>pesquisa profunda em PDF</b>, <b>automação</b>, <b>integração de IA</b> e <b>Zettelkasten Visual</b>. Mas tanto poder vem com complexidade.</p><p>Pare de tentar e errar. <a href="${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EM}" target="_blank">👉 Junte-se ao Excalidraw Mastery</a> para aprender estas configurações exatas passo a passo. Supere a fricção da ferramenta e domine seu conhecimento ao lado de uma comunidade de pensadores visuais!</p>`,
  EXCALIDRAW_MASTERY_PROMO_SHOW: "Mostrar",
  EXCALIDRAW_MASTERY_PROMO_HIDE: "Ocultar",
  LINKS_BUGS_ARIA:
    "Reporte bugs e solicite recursos na página do GitHub do plugin",
  LINKS_BUGS: "Reportar bugs",
  LINKS_YT_ARIA:
    "Confira meu canal do YouTube para aprender sobre Pensamento Visual e Excalidraw",
  LINKS_YT: "Aprender no YouTube",
  LINKS_JOIN_SYM_ARIA:
    "Aprenda Excalidraw, domine o Pensamento Visual, junte-se à comunidade",
  LINKS_JOIN_SYM: "Aprenda Excalidraw",
  LINKS_TWITTER: "Siga-me",
  LINKS_BOOK_ARIA: "Leia Sketch Your Mind, meu livro sobre Pensamento Visual",
  LINKS_BOOK: "Ler o livro",
  LINKS_WIKI: "Wiki do plugin",
  LINKS_WIKI_ARIA: "Explore a Wiki do Plugin Excalidraw",
  RELEASE_NOTES_NAME: "Exibir notas da versão após atualização",
  RELEASE_NOTES_DESC: `<b><u>Ativado:</u></b> exibe as notas de versão sempre que você atualizar o Excalidraw para uma versão mais nova.<br><b><u>Desativado:</u></b> modo silencioso. Você ainda pode ler as notas de versão no <a href="${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES}">GitHub</a>.`,
  WARN_ON_MANIFEST_MISMATCH_NAME:
    "Avisar sobre atualizações incompletas do plugin",
  WARN_ON_MANIFEST_MISMATCH_DESC:
    "Verifica se o executável do Excalidraw instalado corresponde à versão mostrada na lista de plugins do Obsidian. Se não corresponderem (frequente após sincronização parcial), você verá um aviso e poderá atualizar. Desative para parar de verificar.",
  NEWVERSION_NOTIFICATION_NAME: "Notificação de atualização do plugin",
  NEWVERSION_NOTIFICATION_DESC:
    "<b><u>Ativado:</u></b> mostra uma notificação quando uma nova versão do plugin está disponível.<br><b><u>Desativado:</u></b> modo silencioso. Verifique atualizações do plugin em Plugins da comunidade.",
  BASIC_HEAD: "Básico",
  BASIC_UPDATES_STARTUP_HEAD: "Atualizações e inicialização",
  BASIC_UPDATES_STARTUP_DESC:
    "Notas de versão, verificações e notificações de atualização e a tela de abertura.",
  BASIC_FILES_FOLDERS_HEAD: "Arquivos e pastas",
  BASIC_FILES_FOLDERS_DESC:
    "Pastas e caminhos padrão para desenhos, recortes, anotações, templates e scripts do Excalidraw Automate.",
  BASIC_STENCIL_LIBRARY_HEAD: "Biblioteca de Estêncis",
  BASIC_STENCIL_LIBRARY_DESC:
    "Escolha onde os dados da biblioteca de estêncis são armazenados e configure sua pasta no vault e arquivo de biblioteca local.",
  BASIC_DESC:
    'Nas configurações "Básico", você define exibição de notas de versão após atualizações, notificações de atualização do plugin, local padrão para novos desenhos, pasta do Excalidraw para embutir desenhos em documentos ativos, arquivo de template e pasta de scripts do Excalidraw Automate.',
  FOLDER_NAME: "Pasta do Excalidraw (SENsÍVEL a MAIÚSCULAS!)",
  FOLDER_DESC:
    "Local padrão para novos desenhos. Se vazio, os desenhos serão criados na raiz do vault.",
  CROP_SUFFIX_NAME: "Sufixo do arquivo de recorte",
  CROP_SUFFIX_DESC:
    "A última parte do nome do arquivo para novos desenhos criados ao recortar uma imagem. Deixe vazio se não precisar de sufixo.",
  CROP_PREFIX_NAME: "Prefixo do arquivo de recorte",
  CROP_PREFIX_DESC:
    "A primeira parte do nome do arquivo para novos desenhos criados ao recortar uma imagem. Deixe vazio se não precisar de prefixo.",
  ANNOTATE_SUFFIX_NAME: "Sufixo do arquivo de anotação",
  ANNOTATE_SUFFIX_DESC:
    "A última parte do nome do arquivo para novos desenhos criados ao anotar uma imagem. Deixe vazio se não precisar de sufixo.",
  ANNOTATE_PREFIX_NAME: "Prefixo do arquivo de anotação",
  ANNOTATE_PREFIX_DESC:
    "A primeira parte do nome do arquivo para novos desenhos criados ao anotar uma imagem. Deixe vazio se não precisar de prefixo.",
  ANNOTATE_PRESERVE_SIZE_NAME: "Preservar tamanho da imagem ao anotar",
  ANNOTATE_PRESERVE_SIZE_DESC:
    "Ao anotar uma imagem no markdown, o link da imagem substituta incluirá a largura da imagem original.",
  CROP_FOLDER_NAME: "Pasta dos arquivos de recorte (SENsÍVEL a MAIÚSCULAS!)",
  CROP_FOLDER_DESC:
    "Local padrão para novos desenhos criados ao recortar uma imagem. Se vazio, os desenhos serão criados conforme as configurações de anexos do Vault.",
  ANNOTATE_FOLDER_NAME:
    "Pasta dos arquivos de anotação (SENsÍVEL a MAIÚSCULAS!)",
  ANNOTATE_FOLDER_DESC:
    "Local padrão para novos desenhos criados ao anotar uma imagem. Se vazio, os desenhos serão criados conforme as configurações de anexos do Vault.",
  FOLDER_EMBED_NAME:
    "Usar pasta do Excalidraw ao embutir um desenho no documento ativo",
  FOLDER_EMBED_DESC:
    "Define em qual pasta colocar o desenho recém-inserido ao usar a ação da paleta de comandos: 'Criar novo desenho e embutir no documento ativo'.<br><b><u>Ativado:</u></b> usa a pasta do Excalidraw<br><b><u>Desativado:</u></b> usa a pasta de anexos definida nas configurações do Obsidian.",
  TEMPLATE_NAME:
    "Arquivo ou pasta de template do Excalidraw (SENsÍVEL a MAIÚSCULAS!)",
  TEMPLATE_DESC:
    "Caminho completo de arquivo ou pasta do template do Excalidraw.<br><b>Arquivo de template:</b> ex.: se seu template está na pasta padrão do Excalidraw e chama-se Template.md, a configuração seria Excalidraw/Template.md (ou apenas Excalidraw/Template — a extensão .md é opcional). Em modo de compatibilidade, seu template deve ser um arquivo legado como Excalidraw/Template.excalidraw. <br><b>Pasta de templates:</b> você também pode definir uma pasta; será perguntado qual template usar ao criar um novo desenho.<br><b>Dica de profissional:</b> se usa o plugin Templater do Obsidian, pode adicionar código Templater aos seus templates para automatizar a configuração dos desenhos.",
  SCRIPT_FOLDER_NAME:
    "Pasta de scripts do Excalidraw Automate (SENsÍVEL a MAIÚSCULAS!)",
  SCRIPT_FOLDER_DESC:
    "Arquivos nesta pasta serão tratados como scripts do Excalidraw Automate. Acesse seus scripts pelo comando do Obsidian; atribua atalhos como a qualquer comando. A pasta não pode ser a raiz do Vault. ",
  AI_HEAD: "Configurações de IA - Experimental",
  AI_DESC: `Nas configurações de "IA", você configura o uso de APIs como a do GPT da OpenAI. Enquanto a API está em beta, o uso é estritamente limitado — por isso exigimos que você use sua própria chave. Crie uma conta OpenAI, adicione um pequeno crédito (mínimo 5 USD) e gere sua chave. Com a chave definida, você pode usar as ferramentas de IA no Excalidraw. Estas configurações são usadas pelo ExcalidrawAutomate, chat Mermaid, diagrama-para-código e recursos de IA relacionados. Configure um ou mais perfis de provedor e atribua seus modelos de texto, visão e imagem a eles. Configurações antigas específicas da OpenAI são migradas automaticamente na primeira execução.`,
  AI_ENABLED_NAME: "Ativar recursos de IA",
  AI_ENABLED_DESC:
    "É preciso reabrir o Excalidraw para as alterações terem efeito.",
  AI_VERBOSE_LOGGING_NAME: "Ativar log detalhado de IA",
  AI_VERBOSE_LOGGING_DESC:
    "Grava diagnósticos detalhados de requisições e respostas de IA no console de desenvolvedor. Deixe desativado, salvo para solucionar problemas.",
  AI_PROVIDER_NAME: "Definir provedores disponíveis",
  AI_PROVIDER_DESC:
    "Define os perfis de provedor disponíveis para as listas de modelos abaixo. Texto, Visão e Imagem selecionam seus provedores separadamente.",
  AI_PROVIDER_PROFILE_ROW_DESC: "Tipo: {{providerType}}<br>API: {{apiKey}}",
  AI_PROVIDER_OPTION_OPENAI: "OpenAI",
  AI_PROVIDER_OPTION_ANTHROPIC: "Anthropic / Claude",
  AI_PROVIDER_OPTION_GOOGLE: "Google / Gemini",
  AI_PROVIDER_OPTION_XAI: "xAI / Grok",
  AI_PROVIDER_OPTION_OPENAI_COMPATIBLE: "Compatível com OpenAI / local",
  AI_PROVIDER_API_KEY_SET: "Configurada",
  AI_PROVIDER_API_KEY_NOT_SET: "Não definida",
  AI_PROVIDER_EDIT: "Editar provedor",
  AI_PROVIDER_ADD: "Adicionar provedor",
  AI_PROVIDER_REMOVE: "Remover provedor",
  AI_PROVIDER_RESTORE_DEFAULTS: "Restaurar padrões de provedores",
  AI_PROVIDER_DEFAULT_TEXT_MODEL_NAME: "Modelo de texto e multimodal",
  AI_PROVIDER_DEFAULT_TEXT_MODEL_DESC:
    "Modelo usado para chat de texto e requisições com imagem, como chat Mermaid, diagrama-para-código e análise de wireframe.<br>Provedor: {{provider}} ({{providerType}})<br>Chave de API: {{apiKey}}<br>Modelo: {{model}}<br>Endpoint: {{endpoint}}<br>Suporte multimodal: {{multimodalSupport}}",
  AI_PROVIDER_DEFAULT_IMAGE_MODEL_NAME: "Modelo de imagem",
  AI_PROVIDER_DEFAULT_IMAGE_MODEL_DESC:
    "Modelo usado para geração de imagem, transformações por prompt e edições com máscara. Use os botões Editar, Adicionar e Remover para modificar a lista.<br>Provedor: {{provider}} ({{providerType}})<br>Chave de API: {{apiKey}}<br>Modelo: {{model}}<br>Resoluções suportadas: {{sizes}}<br>Transformações por prompt: {{supportsPromptImageTransforms}}<br>Edições com máscara: {{supportsMaskImageEdits}}",
  AI_MODEL_CONFIG_DERIVED_ENDPOINT: "Derivado do provedor selecionado",
  AI_MODEL_EDIT: "Editar modelo",
  AI_MODEL_ADD: "Adicionar modelo",
  AI_MODEL_REMOVE: "Remover plugin",
  AI_MODEL_RESTORE_DEFAULTS: "Restaurar padrões de modelos",
  AI_IMAGE_MODEL_CAPABILITIES_SIZES_NAME: "Resoluções suportadas",
  AI_IMAGE_MODEL_CAPABILITIES_SIZES_PLACEHOLDER:
    "1024x1024, 1536x1024, 1024x1536",
  AI_IMAGE_MODEL_CAPABILITIES_TRANSFORMS_NAME:
    "Transformações de imagem por prompt",
  AI_IMAGE_MODEL_CAPABILITIES_TRANSFORMS_DESC:
    "Ative isto quando o modelo aceita uma imagem de entrada mais um prompt de texto para edições sem máscara.",
  AI_IMAGE_MODEL_CAPABILITIES_MASK_EDITS_NAME: "Edições de imagem com máscara",
  AI_IMAGE_MODEL_CAPABILITIES_MASK_EDITS_DESC:
    "Ative isto quando o modelo suporta substituir regiões selecionadas de uma imagem de entrada por uma máscara.",
  AI_IMAGE_MODEL_CAPABILITIES_EDITS_YES: "Sim",
  AI_IMAGE_MODEL_CAPABILITIES_EDITS_NO: "Não",
  AI_IMAGE_MODEL_CAPABILITY_MODAL_ADD_TITLE:
    "Adicionar entrada de modelo de imagem",
  AI_IMAGE_MODEL_CAPABILITY_MODAL_EDIT_TITLE:
    "Editar entrada de modelo de imagem",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_MODEL_NAME: "ID do modelo",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_MODEL_DESC:
    "Use o nome exato do modelo exposto pelo seu provedor.",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_MODEL_PLACEHOLDER: "ex.: gpt-image-2",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_SIZES_DESC:
    "Adicione uma resolução suportada por linha.",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_SIZE_LABEL: "Resolução",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_ADD_SIZE: "Adicionar resolução",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_REMOVE_SIZE: "Remover",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_MODEL_REQUIRED:
    "O ID do modelo é obrigatório.",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_SIZE_REQUIRED:
    "Adicione ao menos uma resolução suportada.",
  AI_IMAGE_MODEL_CAPABILITIES_MODAL_DUPLICATE_MODEL:
    "Já existe uma entrada de modelo com este ID.",
  AI_PROVIDER_PROFILE_MODAL_ADD_TITLE: "Adicionar perfil de provedor",
  AI_PROVIDER_PROFILE_MODAL_EDIT_TITLE: "Editar perfil de provedor",
  AI_PROVIDER_PROFILE_MODAL_NAME_NAME: "Nome do perfil",
  AI_PROVIDER_PROFILE_MODAL_NAME_DESC:
    "Este rótulo aparece nos menus de modelos.",
  AI_PROVIDER_PROFILE_MODAL_NAME_PLACEHOLDER: "ex.: OpenAI",
  AI_PROVIDER_PROFILE_MODAL_TYPE_NAME: "Tipo de provedor",
  AI_PROVIDER_PROFILE_MODAL_TYPE_DESC:
    "Selecione a família de API usada por este perfil de provedor.",
  AI_PROVIDER_PROFILE_MODAL_API_KEY_NAME: "Chave de API",
  AI_PROVIDER_PROFILE_MODAL_API_KEY_DESC:
    "Armazenada com este perfil de provedor e usada por qualquer modelo atribuído a ele.",
  AI_PROVIDER_PROFILE_MODAL_API_KEY_PLACEHOLDER: "Chave de API do provedor",
  AI_PROVIDER_PROFILE_MODAL_BASE_URL_NAME: "URL base",
  AI_PROVIDER_PROFILE_MODAL_BASE_URL_DESC:
    "URL base usada para derivar os endpoints do provedor.",
  AI_PROVIDER_PROFILE_MODAL_BASE_URL_PLACEHOLDER:
    "ex.: https://api.openai.com/v1",
  AI_PROVIDER_PROFILE_MODAL_OPENAI_COMPATIBLE_HINT:
    "Para LLMs locais compatíveis com OpenAI, digite uma chave de API fictícia se nenhuma chave real for exigida, para que o Excalidraw reconheça o perfil como configurado.",
  AI_PROVIDER_PROFILE_MODAL_NAME_REQUIRED:
    "O nome do perfil de provedor é obrigatório.",
  AI_PROVIDER_PROFILE_MODAL_DUPLICATE_NAME:
    "Já existe um perfil de provedor com este nome.",
  AI_MODEL_CONFIG_MODAL_NAME_NAME: "Nome da entrada",
  AI_MODEL_CONFIG_MODAL_NAME_DESC: "Este rótulo aparece no menu suspenso.",
  AI_MODEL_CONFIG_MODAL_NAME_PLACEHOLDER: "ex.: gpt-5-mini",
  AI_MODEL_CONFIG_MODAL_PROVIDER_NAME: "Provedor",
  AI_MODEL_CONFIG_MODAL_PROVIDER_DESC:
    "Escolha qual perfil de provedor este modelo deve usar.",
  AI_MODEL_CONFIG_MODAL_MODEL_NAME: "Nome do modelo",
  AI_MODEL_CONFIG_MODAL_MODEL_DESC: "Nome exato do modelo enviado à API.",
  AI_MODEL_CONFIG_MODAL_MODEL_PLACEHOLDER: "ex.: gpt-5-mini",
  AI_MODEL_CONFIG_MODAL_ENDPOINT_NAME: "Sobrescrever endpoint",
  AI_MODEL_CONFIG_MODAL_ENDPOINT_DESC:
    "Sobrescrita opcional de endpoint completo para este modelo. Deixe vazio para derivar do perfil do provedor.",
  AI_MODEL_CONFIG_MODAL_ENDPOINT_PLACEHOLDER: "Endpoint completo opcional",
  AI_MODEL_CONFIG_MODAL_MULTIMODAL_NAME: "Suporte multimodal",
  AI_MODEL_CONFIG_MODAL_MULTIMODAL_DESC:
    "Permitir que este modelo de texto aceite entradas de imagem para análises e tarefas do tipo diagrama-para-código.",
  AI_MODEL_CONFIG_MODAL_NAME_REQUIRED: "O nome da entrada é obrigatório.",
  AI_MODEL_CONFIG_MODAL_PROVIDER_REQUIRED: "Selecione um perfil de provedor.",
  AI_MODEL_CONFIG_MODAL_MODEL_REQUIRED: "O nome do modelo é obrigatório.",
  AI_MODEL_CONFIG_MODAL_DUPLICATE_NAME:
    "Já existe uma entrada de modelo com este nome.",
  AI_TEXT_MODEL_MODAL_ADD_TITLE: "Adicionar modelo de texto",
  AI_TEXT_MODEL_MODAL_EDIT_TITLE: "Editar modelo de texto",
  AI_VISION_MODEL_MODAL_ADD_TITLE: "Adicionar modelo de visão",
  AI_VISION_MODEL_MODAL_EDIT_TITLE: "Editar modelo de visão",
  AI_IMAGE_MODEL_MODAL_ADD_TITLE: "Adicionar modelo de imagem",
  AI_IMAGE_MODEL_MODAL_EDIT_TITLE: "Editar modelo de imagem",
  AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_NAME:
    "Orçamento padrão de tokens de saída da IA",
  AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_DESC:
    "Valor padrão de AIRequest.maxOutgoingTokens. O Excalidraw usa isto como orçamento aproximado do conteúdo de texto enviado e corta prompts longos ou histórico de chat antigo primeiro. Também pode afetar texto enviado com requisições de imagem.",
  AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_PLACEHOLDER: "ex.: 8000",
  AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_NAME:
    "Limite padrão de tokens de resposta da IA",
  AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_DESC:
    "Valor padrão de AIRequest.maxTokens. Limita respostas de texto ou multimodais retornadas pelo modelo. Não afeta geração direta de imagem nem endpoints de edição de imagem.",
  AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_PLACEHOLDER: "ex.: 4096",
  AI_USAGE_MODAL_TITLE: "Uso de IA (esta sessão)",
  AI_USAGE_MODAL_TEXT_MODELS_HEADING: "Modelos de texto / multimodais",
  AI_USAGE_MODAL_IMAGE_MODELS_HEADING: "Modelos de geração de imagem",
  AI_USAGE_MODAL_TABLE_COL_MODEL: "Modelo",
  AI_USAGE_MODAL_TABLE_COL_INPUT: "Tokens de entrada",
  AI_USAGE_MODAL_TABLE_COL_OUTPUT: "Tokens de saída",
  AI_USAGE_MODAL_TABLE_COL_IMAGE_MODEL: "Modelo",
  AI_USAGE_MODAL_TABLE_COL_GENERATIONS: "Imagens geradas",
  AI_USAGE_MODAL_TABLE_TOTAL: "Total",
  AI_USAGE_MODAL_NO_USAGE: "Nenhuma requisição de IA foi feita nesta sessão.",
  AI_USAGE_MODAL_SESSION_NOTE:
    "O uso é acumulado apenas para a sessão atual do Obsidian e não é persistido entre reinicializações.",
  AI_USAGE_MODAL_COPY_MARKDOWN: "Copiar como Markdown",
  AI_USAGE_MODAL_COPY_SUCCESS:
    "Tabela de uso copiada para a área de transferência.",
  AI_USAGE_MODAL_COPY_FAILURE: "Falha ao copiar para a área de transferência.",
  AI_USAGE_MODAL_TABLE_MARKDOWN_TITLE: "## Uso de IA (esta sessão)",
  AI_USAGE_SETTINGS_BUTTON_NAME: "Uso de tokens da sessão",
  AI_USAGE_SETTINGS_BUTTON_DESC:
    "Veja o consumo de tokens de IA da sessão atual do Obsidian por modelo. O uso reinicia ao reiniciar o app.",
  SAVING_HEAD: "Salvamento",
  SAVING_STORAGE_AUTOSAVE_HEAD: "Armazenamento e salvamento automático",
  SAVING_STORAGE_AUTOSAVE_DESC:
    "Controle a compressão JSON do desenho e escolha intervalos de salvamento automático desktop e mobile.",
  SAVING_DESC:
    "Na seção 'Salvamento' das configurações do Excalidraw, você configura como seus desenhos são salvos. Inclui compressão do JSON no Markdown, intervalos de salvamento automático desktop e mobile, formatos de nome de arquivo e a escolha entre extensão .excalidraw.md ou .md. ",
  COMPRESS_NAME: "Comprimir JSON do Excalidraw no Markdown",
  COMPRESS_DESC: `Ativando, o Excalidraw armazenará o JSON do desenho num formato Base64 comprimido usando o algoritmo <a href="${URLs.PIEROXY_NET_BLOG_PAGES_LZ_STRING_INDEX_HTML}">LZ-String</a>. Reduz a chance de o JSON poluir seus resultados de busca no Obsidian e, como efeito colateral, o tamanho dos arquivos. Ao mudar um desenho para a visualização Markdown (menu de opções), o arquivo é salvo sem compressão para leitura/edição; comprime novamente ao voltar à visualização Excalidraw. A configuração vale 'daqui pra frente': desenhos existentes só são afetados ao abrir e salvar.<br><b><u>Ativado:</u></b> comprimir JSON do desenho<br><b><u>Desativado:</u></b> deixar sem compressão`,
  DECOMPRESS_FOR_MD_NAME:
    "Descomprimir JSON do Excalidraw na visualização Markdown",
  DECOMPRESS_FOR_MD_DESC:
    "Ativando, o Excalidraw descomprimirá automaticamente o JSON do desenho ao mudar para a visualização Markdown. Permite ler e editar a string JSON facilmente. O desenho será comprimido novamente ao voltar à visualização Excalidraw e salvar (CTRL+S).<br>Recomendo manter desativado: resulta em arquivos menores e evita resultados desnecessários na busca do Obsidian. Você sempre pode usar o comando 'Excalidraw: Decomprimir arquivo Excalidraw atual' da paleta para descomprimir manualmente quando precisar ler ou editar.",
  AUTOSAVE_INTERVAL_DESKTOP_NAME:
    "Intervalo de salvamento automático no Desktop",
  AUTOSAVE_INTERVAL_DESKTOP_DESC:
    "O intervalo entre salvamentos. O salvamento automático será ignorado se não houver mudanças. O Excalidraw também salva ao fechar uma aba ou navegar dentro do Obsidian para longe da aba ativa (ex.: clicar na fita do Obsidian ou verificar backlinks). Não conseguirá salvar ao encerrar o Obsidian matando o processo ou fechando o app inteiro.",
  AUTOSAVE_INTERVAL_MOBILE_NAME: "Intervalo de salvamento automático no Mobile",
  AUTOSAVE_INTERVAL_MOBILE_DESC:
    "Recomendo intervalo mais frequente em celulares. O Excalidraw também salva ao fechar uma aba ou navegar para longe da aba ativa (ex.: tocar na fita do Obsidian ou verificar backlinks). Não conseguirá salvar ao encerrar o Obsidian diretamente (deslizando-o para fora). Note também que, ao trocar de app num dispositivo móvel, às vezes Android e iOS fecham o Obsidian em segundo plano para poupar recursos; nesse caso o Excalidraw não conseguirá salvar as últimas mudanças.",
  FILENAME_HEAD: "Nome de arquivo",
  FILENAME_GROUP_DESC:
    "Configure como nomes de arquivos de desenhos novos, embutidos, recortados e anotados são gerados.",
  FILENAME_DESC: `<p>Clique neste link para a <a href="${URLs.MOMENTJS_COM_DOCS}">referência de formato de data e hora</a>.</p>`,
  FILENAME_SAMPLE: "Nome de arquivo para um novo desenho: ",
  FILENAME_EMBED_SAMPLE: "Nome de arquivo para um novo desenho embutido: ",
  FILENAME_PREFIX_NAME: "Prefixo do nome de arquivo",
  FILENAME_PREFIX_DESC: "A primeira parte do nome do arquivo",
  FILENAME_PREFIX_EMBED_NAME:
    "Prefixo do nome de arquivo ao embutir um novo desenho numa nota markdown",
  FILENAME_PREFIX_EMBED_DESC:
    "O nome do arquivo do desenho recém-inserido deve começar com o nome da nota markdown ativa ao usar a ação: <code>Criar novo desenho e embutir no documento ativo</code>?<br><b><u>Ativado:</u></b> sim, começa com o nome do documento ativo<br><b><u>Desativado:</u></b> não inclui o nome do documento ativo",
  FILENAME_POSTFIX_NAME:
    "Texto personalizado após o nome da nota markdown ao embutir",
  FILENAME_POSTFIX_DESC:
    "Afeta o nome do arquivo apenas ao embutir num documento markdown. Este texto será inserido após o nome da nota, mas antes da data.",
  FILENAME_DATE_NAME: "Data no nome de arquivo",
  FILENAME_DATE_DESC:
    "A última parte do nome do arquivo. Deixe vazio se não quiser data.",
  FILENAME_EXCALIDRAW_EXTENSION_NAME: ".excalidraw.md ou .md",
  FILENAME_EXCALIDRAW_EXTENSION_DESC:
    "Esta configuração não se aplica se você usa o Excalidraw em modo de compatibilidade, ou seja, sem usar arquivos markdown do Excalidraw.<br><b><u>Ativado:</u></b> o nome do arquivo termina com .excalidraw.md<br><b><u>Desativado:</u></b> o nome do arquivo termina com .md",
  DISPLAY_HEAD: "Aparência e comportamento do Excalidraw",
  DISPLAY_DESC:
    "Na seção 'aparência e comportamento' das configurações do Excalidraw, você ajusta como o Excalidraw aparece e se comporta. Inclui estilo dinâmico, modo canhoto, correspondência de temas do Excalidraw e do Obsidian, modos padrão e mais.",
  DISPLAY_EDITOR_PREVIEWS_HEAD: "Edição e pré-visualizações",
  DISPLAY_EDITOR_PREVIEWS_DESC:
    "Configure gestos de edição no canvas e como arquivos Excalidraw aparecem no modo de leitura e pré-visualização hover.",
  OVERRIDE_OBSIDIAN_FONT_SIZE_NAME:
    "Limitar tamanho da fonte do Obsidian ao texto do editor",
  OVERRIDE_OBSIDIAN_FONT_SIZE_DESC:
    "A configuração de tamanho de fonte do Obsidian afeta toda a interface, incluindo o Excalidraw. Ativar esta opção restringe mudanças de fonte ao texto do editor, melhorando o visual do Excalidraw. Se partes da interface ficarem incorretas, desative.",
  DYNAMICSTYLE_NAME: "Estilização dinâmica",
  DYNAMICSTYLE_DESC:
    "Alterar as cores da interface do Excalidraw para combinar com a cor do canvas",
  LEFTHANDED_MODE_NAME: "Modo canhoto",
  LEFTHANDED_MODE_DESC:
    "Atualmente só tem efeito no modo bandeja. Se ativado, a bandeja ficará no lado direito.<br><b><u>Ativado:</u></b> Modo canhoto.<br><b><u>Desativado:</u></b> Modo destro.",
  IFRAME_MATCH_THEME_NAME: "Embutidos markdown acompanham o tema do Excalidraw",
  IFRAME_MATCH_THEME_DESC:
    "<b><u>Ativado:</u></b> se, por exemplo, você usa o Obsidian em modo escuro mas o excalidraw com fundo claro, o documento markdown embutido seguirá o tema do Excalidraw (cores claras em modo claro).<br><b><u>Desativado:</u></b> o documento markdown embutido seguirá o tema do Obsidian (cores escuras em modo escuro).",
  MATCH_THEME_NAME: "Novo desenho acompanha o tema do Obsidian",
  MATCH_THEME_DESC:
    "Se o tema for escuro, novos desenhos serão criados em modo escuro. Não se aplica ao usar template para novos desenhos, nem ao abrir desenhos existentes (estes seguem o tema do template/desenho).<br><b><u>Ativado:</u></b> segue o tema do Obsidian<br><b><u>Desativado:</u></b> segue o tema definido no seu template",
  MATCH_THEME_ALWAYS_NAME: "Desenhos existentes acompanham o tema do Obsidian",
  MATCH_THEME_ALWAYS_DESC:
    "Se o tema for escuro, os desenhos abrirão no modo escuro. Se o tema for claro, abrirão no modo claro.<br><b><u>Ativado:</u></b> seguir tema do Obsidian<br><b><u>Desativado:</u></b> abrir com o mesmo tema do último salvamento",
  MATCH_THEME_TRIGGER_NAME: "Excalidraw acompanha mudanças de tema do Obsidian",
  MATCH_THEME_TRIGGER_DESC:
    "Se esta opção estiver ativada, o painel do Excalidraw aberto mudará para modo claro/escuro quando o tema do Obsidian mudar.<br><b><u>Ativado:</u></b> seguir mudanças de tema<br><b><u>Desativado:</u></b> desenhos não são afetados por mudanças de tema do Obsidian",
  DEFAULT_OPEN_MODE_NAME: "Modo padrão ao abrir o Excalidraw",
  DEFAULT_OPEN_MODE_DESC:
    "Especifica o modo de abertura do Excalidraw: Normal, Zen ou Visualização. Você também pode definir esse comportamento por arquivo adicionando a chave de frontmatter excalidraw-default-mode com o valor: normal, view ou zen ao seu documento.",
  PHONE_FOOTER_SAFE_AREA_PADDING_NAME:
    "Espaçamento inferior extra para controles do celular",
  PHONE_FOOTER_SAFE_AREA_PADDING_DESC:
    "Adiciona preenchimento extra na parte inferior dos controles de rodapé do Excalidraw para que os botões de zoom e desfazer fiquem acima da barra de navegação do sistema em celulares. Aplica-se apenas a celulares.",
  TABLET_FOOTER_SAFE_AREA_PADDING_NAME:
    "Espaçamento inferior extra para controles do tablet",
  TABLET_FOOTER_SAFE_AREA_PADDING_DESC:
    "Adiciona preenchimento extra na parte inferior dos controles de rodapé do Excalidraw para que os botões de zoom e desfazer fiquem acima da barra de navegação do sistema em tablets. Aplica-se apenas a tablets.",
  DEFAULT_PEN_MODE_NAME: "Modo caneta",
  DEFAULT_PEN_MODE_DESC:
    "O modo caneta deve ser ativado automaticamente ao abrir o Excalidraw?",
  ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME:
    "Ativar criação de texto por duplo clique",
  DISABLE_DOUBLE_TAP_ERASER_NAME:
    "Ativar borracha de duplo toque no modo caneta",
  DISABLE_SINGLE_FINGER_PANNING_NAME:
    "Ativar paneamento com um dedo no modo caneta",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME: "Mostrar mira (+) no modo caneta",
  SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC:
    "Mostrar mira no modo caneta ao usar a ferramenta de desenho livre. <b><u>Ativado:</u></b> MOSTRAR <b><u>Desativado:</u></b> OCULTAR<br>O efeito depende do dispositivo. A mira é tipicamente visível em mesas digitalizadoras, MS Surface, mas não no iOS.",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME:
    "Renderizar arquivo Excalidraw como imagem na pré-visualização ao passar o mouse...",
  SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC:
    "...mesmo que o arquivo tenha a chave de frontmatter <b>excalidraw-open-md: true</b>.<br>Quando esta configuração está desativada e o arquivo está definido para abrir em md por padrão, a pré-visualização hover mostrará o lado markdown do documento.<br>Nota: <b>excalidraw-open-md</b> é diferente de <b>excalidraw-embed-md</b>. Se <b>excalidraw-embed-md</b> for true, a pré-visualização hover sempre mostrará o lado markdown, independente desta configuração. Para forçar a renderização como imagem, use <code>![[drawing#^as-image]]</code> no seu arquivo markdown.",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME:
    "Renderizar como imagem no modo de leitura markdown de um arquivo Excalidraw",
  SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC: `No modo de leitura markdown (ler o verso do desenho), o desenho Excalidraw deve ser renderizado como imagem? Esta configuração não afeta a exibição no modo Excalidraw, ao embutir o desenho num documento markdown ou na pré-visualização hover.<br><ul><li>Veja a configuração relacionada de <a href='#${TAG_PDFEXPORT}'>Exportação PDF</a> em 'Embutir e Exportar' abaixo.</li></ul><br>Você deve fechar e reabrir o arquivo excalidraw/markdown ativo para ter efeito.`,
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME:
    "Renderizar Excalidraw como imagem na exportação em PDF do Obsidian",
  SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC: `Esta configuração controla como arquivos Excalidraw são exportados para PDF usando o recurso nativo <b>Exportar para PDF</b> do Obsidian.<br><ul><li><b>Ativado:</b> o PDF incluirá o desenho Excalidraw como imagem.</li><li><b>Desativado:</b> o PDF incluirá o conteúdo markdown como texto.</li></ul>Nota: não afeta a exportação de PDF dentro do próprio Excalidraw.<br>Veja a configuração relacionada de <a href='#${TAG_MDREADINGMODE}'>Modo de Leitura Markdown</a> em 'Aparência e Comportamento' acima.<br>⚠️ Feche e reabra o arquivo Excalidraw/markdown para ter efeito. ⚠️`,
  MODES_HEAD: "Modos de interface",
  MODES_DESC:
    "Escolha layouts de interface do Excalidraw por dispositivo, controles da barra de título e posicionamento da bandeja para canhoto ou destro.",
  DESKTOP_UI_MODE_NAME: "Modo preferido no Desktop",
  DESKTOP_UI_MODE_DESC: "Selecione o modo de interface padrão para desktop.",
  TABLET_UI_MODE_NAME: "Modo preferido no Tablet",
  TABLET_UI_MODE_DESC: "Selecione o modo de interface padrão para tablets.",
  PHONE_UI_MODE_NAME: "Modo preferido no Celular",
  PHONE_UI_MODE_DESC: "Selecione o modo de interface padrão para celulares.",
  MODE_FULL: "Modo desktop",
  MODE_COMPACT: "Modo compacto",
  MODE_TRAY: "Modo bandeja",
  MODE_PHONE: "Modo celular",
  REAPPLY_UI_MODE_BUTTON: "Reaplicar modo de interface agora",
  HOTKEY_OVERRIDE_HEAD: "Sobrescrever atalhos",
  HOTKEY_OVERRIDE_GROUP_DESC:
    "Gerencie combinações de teclas do Excalidraw que devem ter prioridade sobre atalhos conflitantes do Obsidian.",
  HOTKEY_OVERRIDE_CONTROL_NAME: "Gerenciar sobrescritas de atalhos",
  HOTKEY_OVERRIDE_DESC: `Alguns atalhos do Excalidraw, como <code>${labelCTRL()}+Enter</code> para editar texto ou <code>${labelCTRL()}+K</code> para criar link de elemento, conflitam com atalhos do Obsidian. As combinações adicionadas abaixo sobrescreverão os atalhos do Obsidian dentro do Excalidraw; assim, você pode adicionar <code>${labelCTRL()}+G</code> para Agrupar Objetos por padrão em vez de abrir a Visualização de Grafo.`,
  THEME_HEAD: "Tema e estilo",
  THEME_DESC:
    "Controle estilo da interface, temas de desenho e embutidos, modo de abertura e espaçamento de área segura mobile.",
  ZOOM_AND_PAN_HEAD: "Zoom e paneamento",
  ZOOM_AND_PAN_DESC:
    "Configure comportamento de mouse, toque, abertura, redimensionamento e faixa de zoom.",
  DEFAULT_PINCHZOOM_NAME: "Permitir zoom por pinçamento no modo caneta",
  DEFAULT_PINCHZOOM_DESC:
    "O zoom por pinça no modo caneta com a ferramenta de desenho livre é desativado por padrão para evitar zoom acidental com a palma da mão.<br><b><u>Ativado:</u></b> ativa o zoom por pinça no modo caneta<br><b><u>Desativado:</u></b> desativa o zoom por pinça no modo caneta",
  DEFAULT_WHEELZOOM_NAME:
    "Inverter a preferência de zoom por roda do mouse nos desenhos",
  DEFAULT_WHEELZOOM_DESC:
    "Aplica-se a todos os desenhos e inverte a preferência de <b>Dispositivo de entrada</b> do desenho (se a roda do mouse dá zoom ou rola a página). A preferência do desenho aplica-se apenas ao desenho atual e pode ser salva em um template.",
  ZOOM_TO_FIT_NAME: "Ajustar zoom ao redimensionar a visualização",
  ZOOM_TO_FIT_DESC:
    "Ajustar zoom ao desenho quando o painel é redimensionado<br><b><u>Ativado:</u></b> ajustar zoom<br><b><u>Desativado:</u></b> zoom automático desativado",
  ZOOM_TO_FIT_ONOPEN_NAME: "Ajustar zoom ao abrir arquivo",
  ZOOM_TO_FIT_ONOPEN_DESC:
    "Ajustar zoom ao desenho quando o desenho for aberto pela primeira vez<br><b><u>Ativado:</u></b> ajustar zoom<br><b><u>Desativado:</u></b> zoom automático desativado",
  ZOOM_TO_FIT_MAX_LEVEL_NAME: "Nível máximo de zoom no ajuste automático",
  ZOOM_TO_FIT_MAX_LEVEL_DESC:
    "Define o nível máximo que o zoom para ajustar ampliará o desenho. Mínimo 0,5 (50%) e máximo 10 (1000%).",
  ZOOM_STEP_NAME: "Incremento de zoom",
  ZOOM_STEP_DESC:
    "Incremento de zoom (em pontos percentuais) para ações como zoom pela roda do mouse. Valores menores dão controle mais fino, mas podem exigir rolagem excessiva. Padrão: 5%.",
  ZOOM_MIN_NAME: "Zoom mínimo",
  ZOOM_MIN_DESC:
    "Até onde você pode reduzir o zoom (mais do desenho na tela). Padrão: 10%. Valores abaixo de 10% eram historicamente instáveis — reduza com cautela e volte para 10% se houver problemas.",
  ZOOM_MAX_NAME: "Zoom máximo",
  ZOOM_MAX_DESC:
    "Limite superior de zoom. Padrão: 3000%. Normalmente não é preciso alterar; incluído por completude.",
  PEN_HEAD: "Caneta",
  PEN_DESC:
    "Configure modo caneta automático, gestos de toque, a borracha e a mira do freedraw.",
  GRID_HEAD: "Grade",
  GRID_DESC:
    "Configure direção da grade, cor automática ou personalizada e opacidade.",
  GRID_DYNAMIC_COLOR_NAME: "Cor dinâmica da grade",
  GRID_DYNAMIC_COLOR_DESC:
    "<b><u>Ativado:</u></b> muda a cor da grade para combinar com a cor do canvas<br><b><u>Desativado:</u></b> usa a cor abaixo como cor da grade",
  GRID_COLOR_NAME: "Cor da grade",
  GRID_OPACITY_NAME: "Opacidade da grade",
  GRID_OPACITY_DESC:
    "Define a opacidade da grade. 0 é transparente, 100 é opaco.",
  GRID_DIRECTION_NAME: "Direção da grade",
  GRID_DIRECTION_DESC:
    "O primeiro interruptor mostra/oculta a grade horizontal, o segundo mostra/oculta a grade vertical.",
  GRID_HORIZONTAL: "Renderizar grade horizontal",
  GRID_VERTICAL: "Renderizar grade vertical",
  LASER_HEAD: "Ponteiro laser",
  LASER_DESC:
    "Configure a cor do ponteiro laser e a rapidez e distância de dissipação do rastro.",
  LASER_COLOR: "Cor do ponteiro laser",
  LASER_DECAY_TIME_NAME: "Tempo de dissipação do ponteiro laser",
  LASER_DECAY_TIME_DESC:
    "Tempo de dissipação do ponteiro laser em milissegundos. Padrão: 1000 (ou seja, 1 segundo).",
  LASER_DECAY_LENGTH_NAME: "Comprimento de dissipação do ponteiro laser.",
  LASER_DECAY_LENGTH_DESC:
    "Comprimento de dissipação do ponteiro laser em pontos de linha. Padrão: 50.",
  LINKS_HEAD: "Links, transclusão e TODOs",
  LINKS_HEAD_DESC:
    "Na seção 'Links, transclusão e TODOs' das configurações do Excalidraw, você configura como o Excalidraw trata links, transclusões e itens TODO. Inclui abertura de links, gerenciamento de painéis, exibição de links com colchetes, prefixos personalizados, tratamento de TODOs e mais. ",
  LINKS_DESC: `${labelCTRL()}+CLIQUE em <code>[[Text Elements]]</code> para abri-los como links. Se o texto selecionado tiver mais de um <code>[[valid Obsidian links]]</code>, apenas o primeiro será aberto. Se o texto começa como um link web válido (<code>https://</code> ou <code>http://</code>), o plugin o abrirá num navegador. Quando arquivos do Obsidian mudam, o <code>[[link]]</code> correspondente nos seus desenhos também muda. Se não quer texto mudando acidentalmente, use <code>[[links|with aliases]]</code>.`,
  DRAG_MODIFIER_NAME:
    "Teclas modificadoras de clique em link e arrastar-e-soltar",
  DRAG_MODIFIER_GROUP_DESC:
    "Configure gestos de abertura de link e combinações de modificadores específicas de plataforma para cliques e ações de arrastar e soltar.",
  LINK_OPENING_GESTURES_HEAD: "Gestos de abertura de link",
  LINK_OPENING_GESTURES_DESC:
    "Configure atrasos de pressão longa e abertura de link por duplo clique para desenhos embutidos e modo de visualização.",
  WEB_BROWSER_DRAG_ACTION_DESC:
    "Escolha combinações de modificadores para links, imagens, importações e embutíveis arrastados de um navegador.",
  LOCAL_FILE_DRAG_ACTION_DESC:
    "Escolha combinações de modificadores para links, imagens, importações e embutíveis arrastados do sistema operacional.",
  INTERNAL_DRAG_ACTION_DESC:
    "Escolha combinações de modificadores para links, imagens, imagens em tamanho cheio e embutíveis arrastados dentro do Obsidian.",
  PANE_TARGET_DESC:
    "Escolha combinações de modificadores que determinam onde os links clicados abrem.",
  MODIFIER_KEY_USAGE_NAME: "Configurando teclas modificadoras",
  MODIFIER_KEY_COMBINATIONS: "Combinações de modificadores",
  DRAG_MODIFIER_DESC: `Comportamento das teclas modificadoras ao clicar em links e arrastar/soltar elementos. O Excalidraw não validará sua configuração... atenção para evitar conflitos. As configurações são diferentes para Apple e não-Apple; se usa Obsidian em múltiplas plataformas, configure separadamente. Os interruptores seguem a ordem de ${
    DEVICE.isIOS || DEVICE.isMacOS
      ? "SHIFT, CMD, OPT, CONTROL."
      : "SHIFT, CTRL, ALT, META (Windows key)."
  }`,
  LONG_PRESS_DESKTOP_NAME: "Pressão longa para abrir no desktop",
  LONG_PRESS_DESKTOP_DESC:
    "Atraso de pressão longa em milissegundos para abrir um Desenho Excalidraw embutido num arquivo Markdown. ",
  LONG_PRESS_MOBILE_NAME: "Pressão longa para abrir no mobile",
  LONG_PRESS_MOBILE_DESC:
    "Atraso de pressão longa em milissegundos para abrir um Desenho Excalidraw embutido num arquivo Markdown. ",
  DOUBLE_CLICK_LINK_OPEN_VIEW_MODE:
    "Permitir duplo clique para abrir links em modo de visualização",
  ELEMENT_LINK_SYNC_NAME: "Sincronizar link do elemento de texto com o texto",
  ELEMENT_LINK_SYNC_DESC:
    "Quando ativado, o Excalidraw segue o comportamento pré-2.19.0: o primeiro link no corpo do texto é sempre copiado para o campo de link do elemento. Exportações SVG/PNG só mantêm links quando o campo tem um único link (não links no corpo do texto). Ative se você depende de links no corpo do texto e quer que o link do elemento sempre espelhe o primeiro. Desative se gerencia o link do elemento separadamente: metadados como tags, ontologias de link inline ou múltiplos links, ex.: notas estilo dataview '(reminds me of:: [[link]]) #noteToSelf'.",
  FOCUS_ON_EXISTING_TAB_NAME: "Focar na aba existente",
  FOCUS_ON_EXISTING_TAB_DESC:
    "Ao abrir um link, o Excalidraw focará na aba existente se o arquivo já estiver aberto. Ativar esta configuração sobrescreve 'Reutilizar painel adjacente' quando o arquivo já está aberto, exceto para a ação da paleta de comandos 'Abrir o verso-da-nota da imagem excalidraw selecionada'.",
  SECOND_ORDER_LINKS_NAME: "Mostrar links de segunda ordem",
  SECOND_ORDER_LINKS_DESC: `Mostrar links ao clicar num link no Excalidraw. Links de segunda ordem são backlinks apontando para o link clicado. Ao usar ícones de imagem para conectar notas semelhantes, permitem chegar a notas relacionadas num clique em vez de dois. Veja <a href="${URLs.YOUTUBE_COM_SHORTS_O_1LS9C6WBY}">YT Short</a> para entender.`,
  ADJACENT_PANE_NAME: "Reutilizar painel adjacente",
  ADJACENT_PANE_DESC: `Ao clicar num link com ${labelCTRL()}+${labelALT()} no Excalidraw, por padrão o plugin abre o link num novo painel. Ativando esta configuração, o Excalidraw primeiro procura um painel existente e tenta abrir o link lá, com base no seu histórico de foco/navegação, ou seja, o painel ativo antes de você ativar o Excalidraw. `,
  MAINWORKSPACE_PANE_NAME: "Abrir no workspace principal",
  MAINWORKSPACE_PANE_DESC: `Ao clicar num link no Excalidraw com ${labelCTRL()}+${labelALT()}, por padrão o plugin abrirá o link num novo painel na janela ativa atual. Ativando esta configuração, o Excalidraw abrirá o link num painel existente ou novo no workspace principal. `,
  LINK_BRACKETS_NAME: "Mostrar <code>[[brackets]]</code> ao redor dos links",
  LINK_BRACKETS_DESC: `${
    "No modo PRÉ-VISUALIZAÇÃO, ao interpretar Elementos de Texto, coloca colchetes ao redor dos links. " +
    "Você pode sobrescrever por desenho adicionando <code>"
  }${FRONTMATTER_KEYS["link-brackets"].name}: true/false</code> ao frontmatter do arquivo.`,
  LINK_PREFIX_NAME: "Prefixo de link",
  LINK_PREFIX_DESC: `${
    "No modo PRÉ-VISUALIZAÇÃO, se o Elemento de Texto contém um link, precede o texto com estes caracteres. " +
    "Você pode sobrescrever por desenho adicionando <code>"
  }${FRONTMATTER_KEYS["link-prefix"].name}: "📍 "</code> ao frontmatter do arquivo.`,
  URL_PREFIX_NAME: "Prefixo de URL",
  URL_PREFIX_DESC: `${
    "No modo PRÉ-VISUALIZAÇÃO, se o Elemento de Texto contém um link de URL, precede o texto com estes caracteres. " +
    "Você pode sobrescrever por desenho adicionando <code>"
  }${FRONTMATTER_KEYS["url-prefix"].name}: "🌐 "</code> ao frontmatter do arquivo.`,
  PARSE_TODO_NAME: "Interpretar todo",
  PARSE_TODO_DESC:
    "Converter '- [ ] ' e '- [x] ' em caixa de seleção e marcar a caixa.",
  TODO_NAME: "Ícone de TODO aberto",
  TODO_DESC: "Ícone a usar para TODOs abertos",
  DONE_NAME: "Ícone de TODO concluído",
  DONE_DESC: "Ícone a usar para TODOs concluídos",
  HOVERPREVIEW_NAME: `Pré-visualização ao passar o mouse sem pressionar a tecla ${labelCTRL()}`,
  HOVERPREVIEW_DESC: `<b><u>Ativado:</u></b> No <u>modo de visualização</u> do Excalidraw, a pré-visualização hover de [[wiki links]] é mostrada imediatamente, sem precisar segurar ${labelCTRL()}. No <u>modo normal</u>, a pré-visualização aparece imediatamente apenas ao passar o mouse no ícone azul de link no canto superior direito do elemento.<br><b><u>Desativado:</u></b> a pré-visualização só aparece segurando ${labelCTRL()} sobre o link.`,
  LINKOPACITY_NAME: "Opacidade do ícone de link",
  LINKOPACITY_DESC:
    "Opacidade do ícone indicador de link no canto superior direito de um elemento. 1 é opaco, 0 é transparente.",
  LINK_CTRL_CLICK_NAME: `${labelCTRL()}+CLIQUE em texto com [[links]] ou [](links) para abri-los`,
  LINK_CTRL_CLICK_DESC: `Você pode desativar este recurso se ele interferir em recursos padrão do Excalidraw que você usa. Se isto estiver desativado, você pode usar ${labelCTRL()} + ${labelMETA()} ou o indicador de link no canto superior direito do elemento para abrir links.`,
  TRANSCLUSION_WRAP_NAME:
    "Comportamento de quebra de linha do texto transcluído",
  TRANSCLUSION_WRAP_DESC:
    "O número especifica a contagem de caracteres onde o texto deve ser quebrado. Define o comportamento de quebra do texto transcluído. Ative para forçar a quebra (sem transbordo) ou desative para quebra suave (no espaço em branco mais próximo).",
  TRANSCLUSION_DEFAULT_WRAP_NAME: "Padrão de quebra de linha da transclusão",
  TRANSCLUSION_DEFAULT_WRAP_DESC:
    "Você pode definir/sobrescrever manualmente a quebra de linha com o formato `![[page#^block]]{NUMBER}`. Normalmente não convém definir um padrão, porque ao transcluir texto num sticky note o Excalidraw cuida da quebra automaticamente. Defina `0` se não quiser padrão. ",
  PAGE_TRANSCLUSION_CHARCOUNT_NAME:
    "Contagem máxima de caracteres da transclusão de página",
  PAGE_TRANSCLUSION_CHARCOUNT_DESC:
    "O número máximo de caracteres a exibir da página ao transcluir uma página inteira com o formato ![[markdown page]].",
  QUOTE_TRANSCLUSION_REMOVE_NAME:
    "Transclusão de citação: remover '> ' inicial de cada linha",
  QUOTE_TRANSCLUSION_REMOVE_DESC:
    "Remove o '> ' inicial de cada linha da transclusão. Melhora a legibilidade de citações em transclusões somente texto<br><b><u>Ativado:</u></b> remove o '> ' inicial<br><b><u>Desativado:</u></b> não remove (nota: ainda será removido da primeira linha por funcionalidade da API do Obsidian)",
  GET_URL_TITLE_NAME: "Usar oEmbed para resolver título da página",
  GET_URL_TITLE_DESC:
    "Usa o <code>https://noembed.com/embed?url=</code> para obter o título da página ao arrastar um link HTTPS para o Excalidraw",
  LINK_BEHAVIOR_HEAD: "Comportamento de links",
  LINK_BEHAVIOR_DESC:
    "Configure sincronização de links, links relacionados, pré-visualizações hover, tratamento de cliques e busca de títulos.",
  LINK_USAGE_NAME: "Usando links no Excalidraw",
  LINK_OPENING_HEAD: "Comportamento de painéis e abas",
  LINK_OPENING_DESC:
    "Escolha se links abertos reutilizam, focam ou movem entre painéis, abas e o workspace principal.",
  LINK_APPEARANCE_HEAD: "Aparência de links",
  LINK_APPEARANCE_DESC:
    "Configure colchetes, prefixos, ícones e opacidade usados na exibição de links.",
  TODO_HEAD: "TODOs",
  TODO_GROUP_DESC:
    "Configure a interpretação de TODOs e os ícones usados para tarefas abertas e concluídas.",
  TRANSCLUSION_HEAD: "Transclusões de texto",
  TRANSCLUSION_DESC:
    "Configure limites de caracteres, quebra de linha e limpeza de citação para texto markdown transcluído.",
  PDF_TO_IMAGE: "PDF para imagem",
  PDF_TO_IMAGE_SCALE_NAME: "Escala de conversão de PDF para imagem",
  PDF_TO_IMAGE_SCALE_DESC:
    "Define a resolução da imagem gerada da página do PDF. Resolução maior gera imagens maiores em memória e maior carga no sistema (desempenho menor), porém imagem mais nítida. Ao copiar páginas de PDF (como imagens) para Excalidraw.com, o tamanho maior pode exceder o limite de 2MB.",
  EMBED_TOEXCALIDRAW_HEAD: "Embutir arquivos no Excalidraw",
  EMBED_TOEXCALIDRAW_DESC:
    "Na seção Embutir Arquivos das configurações do Excalidraw, você pode configurar como vários arquivos são embutidos no Excalidraw. Inclui opções para embutir arquivos markdown interativos, PDFs e arquivos markdown como imagens.",
  MD_HEAD: "Embutir markdown no Excalidraw como imagem",
  MD_GROUP_DESC:
    "Defina dimensões, fonte, cores, bordas e CSS para arquivos markdown renderizados como imagem.",
  MD_EMBED_CUSTOMDATA_HEAD_NAME: "Arquivos Markdown interativos",
  MD_EMBED_CUSTOMDATA_GROUP_DESC:
    "Configure edição e aparência padrão para futuros embutidos markdown interativos.",
  MD_EMBED_DEFAULTS_CONTROL_NAME: "Padrões de aparência do markdown interativo",
  MD_EMBED_CUSTOMDATA_HEAD_DESC: `As configurações abaixo afetarão apenas embutidos futuros. Embutidos atuais permanecem inalterados. A configuração de tema dos quadros embutidos está na seção "Aparência e comportamento do Excalidraw".`,
  MD_EMBED_SINGLECLICK_EDIT_NAME: "Clique único para editar markdown embutido",
  MD_EMBED_SINGLECLICK_EDIT_DESC:
    "Clique único num arquivo markdown embutido para editá-lo. Quando desativado, o arquivo markdown abre primeiro em modo de pré-visualização e muda para modo de edição ao clicar nele novamente.",
  MD_TRANSCLUDE_WIDTH_NAME:
    "Largura padrão de um documento markdown transcluído",
  MD_TRANSCLUDE_WIDTH_DESC:
    "A largura da página markdown. Afeta a quebra de linha ao transcluir parágrafos longos e a largura do elemento de imagem. Você pode sobrescrever com a sintaxe <code>[[filename#heading|WIDTHxMAXHEIGHT]]</code> no modo markdown sob arquivos embutidos.",
  MD_TRANSCLUDE_HEIGHT_NAME:
    "Altura máxima padrão de um documento markdown transcluído",
  MD_TRANSCLUDE_HEIGHT_DESC:
    "A imagem embutida será tão alta quanto o texto markdown exigir, mas não mais que este valor. Você pode sobrescrever editando o link da imagem embutida no modo markdown com a sintaxe <code>[[filename#^blockref|WIDTHxMAXHEIGHT]]</code>.",
  MD_DEFAULT_FONT_NAME: "A fonte padrão para arquivos markdown embutidos.",
  MD_DEFAULT_FONT_DESC:
    'Defina como "Virgil" ou "Cascadia" ou o nome de arquivo de uma fonte <code>.ttf</code>, <code>.woff</code> ou <code>.woff2</code> válida, ex.: <code>MyFont.woff2</code>. Sobrescreva adicionando a chave de frontmatter <code>excalidraw-font: font_or_filename</code> ao arquivo markdown embutido',
  MD_DEFAULT_COLOR_NAME:
    "A cor padrão de fonte para arquivos markdown embutidos.",
  MD_DEFAULT_COLOR_DESC: `Defina como qualquer nome de cor css válido, ex.: "steelblue" (<a href="${URLs.WWW_W3SCHOOLS_COM_COLORS_COLORS_NAMES_ASP}">nomes de cores</a>), ou cor hexadecimal válida, ex.: "#e67700", ou qualquer string css de cor. Sobrescreva com a chave <code>excalidraw-font-color: steelblue</code> no arquivo embutido.`,
  MD_DEFAULT_BORDER_COLOR_NAME:
    "A cor padrão de borda para arquivos markdown embutidos.",
  MD_DEFAULT_BORDER_COLOR_DESC: `Defina como qualquer nome de cor css válido, ex.: "steelblue" (<a href="${URLs.WWW_W3SCHOOLS_COM_COLORS_COLORS_NAMES_ASP}">nomes de cores</a>), ou cor hexadecimal válida, ex.: "#e67700", ou outra string css de cor. Sobrescreva com <code>excalidraw-border-color: gray</code> no arquivo embutido. Deixe vazio se não quiser borda. `,
  MD_CSS_NAME: "Arquivo CSS",
  MD_CSS_DESC: `Nome do arquivo CSS a aplicar aos embutidos markdown. Forneça com a extensão (ex.: 'md-embed.css'); pode ser até um arquivo markdown (ex.: 'md-embed-css.md'), contanto que o conteúdo seja CSS válido. Para ver o HTML ao qual aplica o CSS, abra o Console de Desenvolvedor (${DEVICE.isIOS || DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i"}) e digite: 'ExcalidrawAutomate.mostRecentMarkdownSVG'. Definir font-family no css tem limitações: por padrão, só as fontes padrão do sistema operacional estão disponíveis (veja o README); pode adicionar uma fonte personalizada com a configuração acima. Sobrescreva com a chave de frontmatter 'excalidraw-css: css_file_in_vault|css-snippet' no arquivo embutido.`,
  EMBED_HEAD: "Embutir Excalidraw nas suas notas e exportação",
  EMBED_DESC: `Nas configurações de "Embutir e Exportar", você define como imagens e desenhos Excalidraw são embutidos e exportados. Inclui o tipo de imagem da pré-visualização markdown (SVG Nativo ou PNG), o tipo de arquivo inserido no documento (original, PNG ou SVG) e o cache de imagens. Controle também dimensionamento, uso de wiki links ou links markdown, temas, cores de fundo e integração com o Obsidian. Há ainda configurações de auto-exportação, que geram SVG e/ou PNG automaticamente com o título dos desenhos, mantendo-os sincronizados com renomeações e exclusões. `,
  EMBED_PREVIEW_LINKS_HEAD: "Pré-visualizações, links e Canvas",
  EMBED_PREVIEW_LINKS_DESC:
    "Escolha formatos de pré-visualização e inserção, comportamento de links-fonte, placeholders e embutidos imersivos de Canvas.",
  EMBED_CANVAS: "Suporte ao Obsidian Canvas",
  EMBED_CANVAS_NAME: "Embutimento imersivo",
  EMBED_CANVAS_DESC:
    "Oculta borda e fundo do nó do Canvas ao embutir um desenho do Excalidraw no Canvas. Note que, para um fundo totalmente transparente na imagem, ainda será preciso configurar o Excalidraw para exportar imagens com fundo transparente.",
  EMBED_CACHING: "Cache de imagens e otimização de renderização",
  EMBED_CACHING_DESC:
    "Ajuste concorrência de renderização e caches de imagem locais, limpe imagens ou backups em cache e, opcionalmente, reutilize pré-visualizações exportadas.",
  RENDERING_CONCURRENCY_NAME: "Concorrência de renderização de imagens",
  RENDERING_CONCURRENCY_DESC:
    "Número de workers paralelos para renderização de imagens. Aumentar acelera a renderização, mas pode desacelerar o resto do sistema. O valor padrão é 3. Aumente se tiver um sistema potente.",
  IMAGE_CACHE_RETENTION_DAYS_NAME: "Retenção do cache local de imagens",
  IMAGE_CACHE_RETENTION_DAYS_DESC:
    "Por quantos dias o Excalidraw deve manter em cache local ativos renderizados (imagens aninhadas, páginas de PDF) antes de limpar entradas não usadas. Itens em uso permanecem disponíveis e o cronômetro é renovado a cada leitura.<br><br>Afeta apenas o cache local neste dispositivo; <b>não</b> altera o tamanho do vault, anexos ou payload de sincronização. O impacto prático é uso de disco/navegador dentro do Obsidian — relevante em celulares e desktops com cota apertada.<br><br>Valores menores liberam espaço antes, mas podem forçar re-renderização; maiores mantêm carregamentos repetidos mais rápidos ao custo de mais armazenamento.",
  EXPORT_SUBHEAD: "Configurações de exportação",
  EXPORT_SUBHEAD_DESC:
    "Configure renderização de PDF e dados de cena exportados, dimensões de imagem, tema e fundo, padrões de PDF e cópias automáticas de PNG/SVG.",
  EMBED_SIZING: "Dimensionamento de imagens",
  EMBED_SIZING_DESC:
    "Defina dimensões padrão de imagem embutida, escala PNG e margem de exportação.",
  EMBED_THEME_BACKGROUND: "Tema da imagem e cor de fundo",
  EMBED_THEME_BACKGROUND_DESC:
    "Escolha fundo e tema da imagem exportada e se as pré-visualizações seguem o tema do Obsidian.",
  EMBED_IMAGE_CACHE_NAME: "Cache de imagens para embutir em markdown",
  EMBED_IMAGE_CACHE_DESC:
    "Armazena em cache imagens para embutir em markdown. Desenhos em cache são atualizados quando o desenho ou uma de suas dependências de arquivo do vault muda.",
  SCENE_IMAGE_CACHE_NAME: "Cache de Excalidraws aninhados na cena",
  SCENE_IMAGE_CACHE_DESC:
    "Armazenar em cache Excalidraws aninhados na Cena para renderização mais rápida, especialmente com aninhamento profundo na sua cena. O Excalidraw identificará mudanças nos desenhos aninhados e suas fontes e atualizará o cache. Desative se suspeitar que o cache não está atualizando corretamente. ",
  EMBED_IMAGE_CACHE_CLEAR: "Limpar cache",
  REFRESH_SCENE_IMAGES:
    "Atualizar imagem selecionada ou todas as imagens do desenho atual",
  BACKUP_CACHE_CLEAR: "Limpar backups",
  BACKUP_CACHE_CLEAR_CONFIRMATION:
    "Esta ação excluirá todos os backups de desenhos do Excalidraw. Backups são uma medida de segurança caso o arquivo do desenho seja danificado. A cada abertura do Obsidian, o plugin exclui automaticamente backups de arquivos que não existem mais no Vault. Tem certeza de que deseja limpar todos os backups?",
  EMBED_REUSE_EXPORTED_IMAGE_NAME:
    "Se encontrada, usar a imagem já exportada para pré-visualização",
  EMBED_REUSE_EXPORTED_IMAGE_DESC: `Esta configuração funciona em conjunto com <a href='#${TAG_AUTOEXPORT}'>Auto-exportar SVG/PNG</a>. Se houver uma imagem exportada com o nome do desenho, usa essa imagem em vez de gerar pré-visualização na hora. Resulta em pré-visualizações mais rápidas, especialmente com muitos objetos embutidos; porém suas últimas mudanças podem não aparecer e a imagem pode não seguir o tema do Obsidian, caso o tema tenha mudado desde a exportação. Aplica-se apenas a embutir imagens em documentos markdown. Por vários motivos, a mesma abordagem não pode ser usada para acelerar o carregamento de desenhos com muitos objetos embutidos. Veja demonstração <a href="${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG}/1.6.23" target='_blank'>aqui</a>.`,
  EMBED_PREVIEW_IMAGETYPE_NAME: "Tipo de imagem na pré-visualização markdown",
  EMBED_PREVIEW_IMAGETYPE_DESC: `<b><u>SVG Nativo</u></b>: Alta qualidade. Sites embutidos, vídeos YouTube, links do Obsidian e imagens externas via URL funcionam. Páginas do Obsidian embutidas não<br><b><u>Imagem SVG</u></b>: Alta qualidade. Elementos embutidos e imagens via URL têm apenas placeholders; links não funcionam<br><b><u>Imagem PNG</u></b>: Qualidade menor, mas às vezes melhor desempenho com desenhos grandes. Elementos embutidos e imagens via URL têm só placeholders; links não funcionam. Além disso, alguns dos <a href="${URLs.WWW_YOUTUBE_COM_WATCH_1}" target='_blank'>recursos de referência a blocos de imagem</a> não funcionam com embutidos PNG.`,
  PREVIEW_MATCH_OBSIDIAN_NAME:
    "Pré-visualização do Excalidraw acompanha o tema do Obsidian",
  PREVIEW_MATCH_OBSIDIAN_DESC:
    "A pré-visualização de imagem em documentos deve seguir o tema do Obsidian. Se ativado, com o Obsidian em modo escuro, imagens do Excalidraw renderizarão em modo escuro; em modo claro, idem. Para um visual mais integrado ao Obsidian, desative 'Exportar imagem com fundo'.",
  EMBED_WIDTH_NAME: "Largura padrão de imagem embutida (transcluída)",
  EMBED_WIDTH_DESC:
    "A largura padrão de um desenho embutido. Aplica-se à pré-visualização ao vivo, modo de leitura e pré-visualizações hover. Você pode especificar largura personalizada ao embutir com <code>![[drawing.excalidraw|100]]</code> ou <code>[[drawing.excalidraw|100x100]]</code>.",
  EMBED_HEIGHT_NAME: " altura máxima padrão de imagem embutida (transcluída)",
  EMBED_HEIGHT_DESC:
    "A altura padrão de um desenho embutido. Aplica-se à pré-visualização ao vivo, modo de leitura e pré-visualizações hover. Você pode especificar altura personalizada ao embutir com <code>![[drawing.excalidraw|100]]</code> ou <code>[[drawing.excalidraw|100x100]]</code>.",
  EMBED_TYPE_NAME: "Tipo de arquivo a inserir no documento",
  EMBED_TYPE_DESC: `Ao embutir uma imagem num documento pela paleta de comandos, esta configuração define se o Excalidraw deve embutir o arquivo original, ou uma cópia PNG ou SVG. Você precisa ativar a <a href='#${TAG_AUTOEXPORT}'>auto-exportação PNG / SVG</a> (abaixo, em Exportação) para que esses tipos fiquem disponíveis. Para desenhos sem PNG ou SVG correspondente disponível, a ação inserirá um link quebrado; abra o desenho original e exporte manualmente. Esta opção não gera arquivos PNG/SVG automaticamente, apenas referencia arquivos já existentes.`,
  EMBED_MARKDOWN_COMMENT_NAME: "Embutir link para o desenho como comentário",
  EMBED_MARKDOWN_COMMENT_DESC:
    "Embutir o link do arquivo Excalidraw original como link markdown sob a imagem, ex.: <code>%%[[drawing.excalidraw]]%%</code>.<br>Em vez do comentário markdown, você também pode selecionar a linha SVG/PNG embutida e usar a ação: '<code>Excalidraw: Abrir desenho Excalidraw</code>'.",
  EMBED_WIKILINK_NAME: "Embutir desenho usando wiki link",
  EMBED_WIKILINK_DESC:
    "<b><u>Ativado:</u></b> o Excalidraw embutirá um [[wiki link]].<br><b><u>Desativado:</u></b> o Excalidraw embutirá um [markdown](link).",
  EMBED_PLACEHOLDER_NAME: "Embutir imagem placeholder",
  EMBED_PLACEHOLDER_DESC:
    "Se ativado, embute uma imagem placeholder quando não há desenho. Se desativado, nenhuma imagem é embutida.",
  EXPORT_PNG_SCALE_NAME: "Escala de exportação de imagem PNG",
  EXPORT_PNG_SCALE_DESC: "A escala de tamanho da imagem PNG exportada",
  EXPORT_BACKGROUND_NAME: "Exportar imagem com fundo",
  EXPORT_BACKGROUND_DESC:
    "Se desativado, a imagem exportada será transparente.",
  EXPORT_PADDING_NAME: "Margem da imagem",
  EXPORT_PADDING_DESC:
    "A margem (em pixels) ao redor da imagem SVG ou PNG exportada. A margem é 0 para referências clippedFrame. Linhas curvas perto da borda podem ser cortadas na exportação; aumente este valor para evitar. Sobrescreva por arquivo com a chave <code>excalidraw-export-padding: 5</code>.",
  EXPORT_THEME_NAME: "Exportar imagem com tema",
  EXPORT_THEME_DESC:
    "Exporta a imagem correspondente ao tema claro/escuro do seu desenho. Se desativado, desenhos criados no modo escuro aparecerão como ficariam no modo claro.",
  EXPORT_EMBED_SCENE_NAME: "Embutir cena na imagem exportada",
  EXPORT_EMBED_SCENE_DESC:
    "Embutir a cena do Excalidraw na imagem exportada. Pode ser sobrescrito por arquivo adicionando a chave de frontmatter <code>excalidraw-export-embed-scene: true/false</code>. A configuração só tem efeito na próxima vez que você (re)abrir desenhos.",
  PDF_EXPORT_SETTINGS: "Configurações de exportação PDF",
  PDF_EXPORT_SETTINGS_DESC:
    "Escolha tamanho de página, orientação, ladrilhamento, margens, cor do papel e alinhamento padrão do PDF.",
  PDF_EXPORT_DEFAULTS_CONTROL_NAME: "Layout padrão de exportação PDF",
  EXPORT_HEAD: "Configurações de auto-exportação",
  EXPORT_AUTOEXPORT_DESC:
    "Mantenha arquivos exportados sincronizados e crie automaticamente variantes SVG, PNG, claro e escuro.",
  SETTINGS_NAVIGATION_OPEN: "Abrir",
  SETTINGS_BREADCRUMB_ARIA: "Caminho das configurações",
  SETTINGS_RELATED_AUTOEXPORT_DESC:
    "Ative cópias automáticas de PNG ou SVG para disponibilizar esses formatos no menu de inserção de arquivos.",
  SETTINGS_RELATED_EMBED_TYPE_DESC:
    "Escolha se Excalidraw, PNG ou SVG é inserido quando você embute um desenho num documento.",
  EXPORT_SYNC_NAME:
    "Manter nomes de arquivo .SVG e/ou .PNG sincronizados com o arquivo do desenho",
  EXPORT_SYNC_DESC:
    "Quando ativado, o plugin atualizará automaticamente o nome dos arquivos .SVG e/ou .PNG quando o desenho na mesma pasta (e mesmo nome) for renomeado. O plugin também excluirá automaticamente os .SVG e/ou .PNG quando o desenho correspondente for excluído. ",
  EXPORT_SVG_NAME: "Auto-exportar SVG",
  EXPORT_SVG_DESC:
    "Cria automaticamente uma exportação SVG do seu desenho com o mesmo nome do arquivo. O plugin salvará o *.SVG na mesma pasta do desenho. Embuta o .svg em seus documentos para tornar seus embutidos independentes de plataforma. Com a auto-exportação ativa, o arquivo será atualizado sempre que você editar o desenho de nome correspondente. Sobrescreva por arquivo com a chave <code>excalidraw-autoexport</code>; valores válidos: <code>none</code>, <code>both</code>, <code>svg</code> e <code>png</code>.",
  EXPORT_PNG_NAME: "Auto-exportar PNG",
  EXPORT_PNG_DESC: "O mesmo que a auto-exportação SVG, mas para *.PNG",
  EXPORT_BOTH_DARK_AND_LIGHT_NAME: "Exportar imagem nos temas claro e escuro",
  EXPORT_BOTH_DARK_AND_LIGHT_DESC:
    "Quando ativado, o Excalidraw exportará dois arquivos em vez de um: filename.dark.png, filename.light.png e/ou filename.dark.svg e filename.light.svg<br>Arquivos duplos serão exportados tanto se auto-export SVG ou PNG (ou ambos) estiverem ativos, quanto ao clicar em exportar numa imagem única.",
  COMPATIBILITY_HEAD: "Recursos de compatibilidade",
  COMPATIBILITY_DESC:
    "Ative estes recursos apenas com forte razão para trabalhar com arquivos excalidraw.com em vez de markdown. Muitos recursos do plugin não são suportados em arquivos legados. Caso típico: vault sobre pasta de projeto do Visual Studio Code com desenhos .excalidraw acessados também pelo VS Code. Outro: usar Excalidraw no Logseq e no Obsidian em paralelo.",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME: "Compatibilidade com Linter",
  DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC:
    "O Excalidraw é sensível à estrutura abaixo de <code># Excalidraw Data</code>. Lint automático pode criar erros nos dados. Embora eu tenha tornado o carregamento resiliente a mudanças de lint, a solução não é infalível.<br><mark>O melhor é evitar lint ou mudanças automáticas nos documentos do Excalidraw por outros plugins.</mark><br>Use esta configuração se, por boas razões, decidiu ignorar minha recomendação e configurou lint dos arquivos.<br>A seção <code>## Text Elements</code> é sensível a linhas vazias. Uma abordagem comum de lint é adicionar linha vazia após títulos; no Excalidraw isto quebra/altera o primeiro elemento de texto. Para contornar, ative: o Excalidraw adicionará um elemento dummy no início de <code>## Text Elements</code> que o linter pode modificar com segurança.",
  PRESERVE_TEXT_AFTER_DRAWING_NAME:
    "Compatibilidade com Zotero e notas de rodapé",
  PRESERVE_TEXT_AFTER_DRAWING_DESC:
    "Preserva o texto após a seção ## Drawing do arquivo markdown. Pode ter um impacto de desempenho muito leve ao salvar desenhos muito grandes.",
  SLIDING_PANES_NAME: "Suporte ao plugin Sliding panes",
  SLIDING_PANES_DESC:
    "É preciso reiniciar o Obsidian para ter efeito.<br>Se você usa o <a href=\"${URLs.GITHUB_COM_DEATHAU_SLIDING_PANES_OBSIDIAN}\" target='_blank'>plugin Sliding Panes</a>, pode ativar esta configuração para que os desenhos funcionem com ele.<br>Nota: o suporte a Sliding Panes causa problemas de compatibilidade com Obsidian Workspaces.<br>Nota: o recurso 'Empilhar abas' já está disponível nativamente no Obsidian, cobrindo a maior parte da funcionalidade.",
  EXPORT_EXCALIDRAW_NAME: "Auto-exportar Excalidraw",
  EXPORT_EXCALIDRAW_DESC:
    "O mesmo que a auto-exportação SVG, mas para *.Excalidraw",
  SYNC_EXCALIDRAW_NAME:
    "Sincronizar *.excalidraw com a versão *.md do mesmo desenho",
  SYNC_EXCALIDRAW_DESC:
    "Se a data de modificação do arquivo *.excalidraw for mais recente que a do arquivo *.md, atualizará o desenho no arquivo .md com base no arquivo .excalidraw",
  COMPATIBILITY_MODE_NAME: "Novos desenhos como arquivos legados",
  COMPATIBILITY_MODE_DESC:
    "⚠️ Ative apenas se souber o que está fazendo. Em 99,9% dos casos você NÃO quer isto ativado. Ativando, desenhos criados pelo ícone de fita, ações da paleta de comandos e o explorador de arquivos serão todos arquivos legados *.excalidraw. Também desativa o lembrete ao abrir um arquivo legado para edição.",
  LATEX_DEFAULT_NAME: "Fórmula LaTeX padrão para novas equações",
  LATEX_DEFAULT_DESC:
    "Deixe vazio se não quiser uma fórmula padrão. Você pode adicionar formatação padrão aqui, como <code>\\\\color{white}</code>.",
  LATEX_PREAMBLE_NAME: "Arquivo de preamble LaTeX (SENsÍVEL a MAIÚSCULAS!)",
  LATEX_PREAMBLE_DESC:
    "Caminho completo do arquivo de preâmbulo; deixe vazio para o padrão. Se o arquivo não existir, esta opção será ignorada.<br><strong>Importante:</strong> exige recarregar o Obsidian após a alteração para ter efeito!",
  NONSTANDARD_HEAD: "Recursos não suportados pelo Excalidraw.com",
  NONSTANDARD_DESC:
    'Estas configurações da seção "Recursos Não Suportados no Excalidraw.com" oferecem personalização além dos recursos padrão do Excalidraw.com; não estão disponíveis lá e aparecerão diferentes ao exportar para lá.\nVocê pode configurar o número de canetas personalizadas exibidas ao lado do menu do Obsidian no canvas. Adicionalmente, pode ativar a opção de fonte local, que adiciona uma fonte local à lista de fontes no painel de propriedades de elementos de texto. ',
  RENDER_TWEAK_HEAD: "Ajustes de renderização",
  MAX_IMAGE_ZOOM_IN_NAME: "Resolução máxima de zoom em imagem",
  MAX_IMAGE_ZOOM_IN_DESC:
    "Para economizar memória e porque o Apple Safari (Obsidian no iOS) tem limitações fixas, o Excalidraw.com limita a resolução máxima de imagens e objetos grandes ao ampliar. Você pode sobrescrever com um multiplicador: multiplica o limite padrão; quanto maior, melhor a resolução ao ampliar e mais memória consumida. Recomendo testar valores. Você bateu no limite quando, ao ampliar uma imagem PNG grande, ela some da tela. Padrão: 1. Sem efeito no iOS.",
  CUSTOM_PEN_HEAD: "Canetas personalizadas",
  CUSTOM_PEN_NAME: "Número de canetas personalizadas",
  CUSTOM_PEN_DESC:
    "Você verá estas canetas ao lado do menu do Obsidian no canvas. Personalize as canetas no canvas pressionando longamente o botão da caneta.",
  EXPERIMENTAL_HEAD: "Recursos diversos",
  EXPERIMENTAL_DESC:
    "Configure padrões de LaTeX, indicadores de tipo de arquivo, comportamento de pré-visualização ao vivo, sugestões de propriedades e a integração experimental de OCR Taskbone.",
  EA_HEAD: "Excalidraw Automate",
  EA_GROUP_DESC:
    "Configure scripts do Excalidraw Automate, comportamento de inicialização e autostart, links de comando e configurações expostas por scripts instalados.",
  EA_DESC: `O ExcalidrawAutomate é uma API de script e automação para o Excalidraw. Infelizmente, a documentação da API é escassa. Recomendo ler o arquivo <a href="${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_BLOB_MASTER_DOCS_API_EXCALIDRAWAUTOMATE_D_TS}">ExcalidrawAutomate.d.ts</a>, visitar a página <a href="${URLs.ZSVICZIAN_GITHUB_IO_OBSIDIAN_EXCALIDRAW_PLUGIN}">ExcalidrawAutomate How-to</a> — embora desatualizada — e ativar o sugestor de campos abaixo. Ele mostrará as funções disponíveis, seus parâmetros e uma breve descrição ao digitar; é a documentação mais atualizada da API.`,
  FIELD_SUGGESTER_NAME: "Ativar sugeridor de campos",
  FIELD_SUGGESTER_DESC:
    "Sugestor de campos emprestado dos plugins Breadcrumbs e Templater. O Sugestor de Campos mostrará um menu de autocomplete ao digitar <code>excalidraw-</code> ou <code>ea.</code>, com descrição de função nas dicas dos itens da lista.",
  ALLOW_JS_FILES_NAME: "Carregar arquivos JavaScript da pasta de scripts",
  ALLOW_JS_FILES_DESC:
    "Quando ativado, o Excalidraw Automate monitora e executa arquivos <code>.js</code> na pasta de Scripts e aceita script de inicialização <code>.js</code>. Por padrão, o Obsidian Sync não sincroniza arquivos não-Markdown, o Obsidian não abre <code>.js</code> para edição e o Explorador os oculta. Ative <b>Sincronizar todos os outros tipos</b> e <b>Mostrar todos os tipos</b> quando preciso. Havendo scripts .md e .js equivalentes, o Markdown é usado.",
  STORE_SCRIPTS_AS_JS_NAME: "Armazenar scripts baixados como",
  STORE_SCRIPTS_AS_JS_DESC:
    "Escolhe o tipo de arquivo local usado para novos downloads e atualizações da Biblioteca de Scripts. Isto é independente de a fonte remota ser <code>.md</code> ou <code>.js</code>.",
  SCRIPT_FILE_EXTENSION_MARKDOWN: "Markdown (.md)",
  SCRIPT_FILE_EXTENSION_JAVASCRIPT: "JavaScript (.js)",
  MIGRATE_SCRIPT_FILES_NAME: "Mover arquivos de script existentes",
  MIGRATE_SCRIPTS_TO_JS_BUTTON: "Mover scripts existentes para .js",
  MIGRATE_SCRIPTS_TO_MD_BUTTON: "Mover scripts existentes para .md",
  MIGRATE_SCRIPT_FILES_STATUS:
    "{eligible} arquivo(s) de script podem ser movidos para {extension}. {skipped}",
  MIGRATE_SCRIPT_FILES_CONFIRM:
    "Faça backup do seu vault antes de continuar.<br><br><b>{count}</b> arquivo(s) de script serão renomeados para <code>{extension}</code>. Caminhos de scripts fixados serão atualizados. {startup} {skipped}",
  MIGRATE_SCRIPT_FILES_STARTUP_INCLUDED:
    "O script de inicialização configurado e sua configuração também serão atualizados.",
  MIGRATE_SCRIPT_FILES_SKIPPED:
    "{count} par(es) .md/.js de mesmo nome não serão movidos.",
  MIGRATE_SCRIPT_FILES_SKIPPED_DETAILS:
    "{count} arquivo(s) de script ignorados porque o destino já existe:\\n{files}",
  MIGRATE_SCRIPT_FILES_NONE:
    "Nenhum arquivo de script elegível para mover foi encontrado.",
  MIGRATE_SCRIPT_FILES_COMPLETE:
    "{count} arquivo(s) de script movidos para {extension}.",
  MIGRATE_SCRIPT_FILES_FAILED:
    "Não foi possível mover os arquivos de script. Renomeações concluídas foram revertidas quando possível.",
  ENABLE_ONLOAD_SCRIPTS_NAME: "Ativar scripts onload",
  ENABLE_ONLOAD_SCRIPTS_CONFIRMATION:
    "Este arquivo inclui um <code>excalidraw-onload-script</code>. Deseja ativar scripts onload?",
  ENABLE_ONLOAD_SCRIPTS_CONFIRM_ENABLE: "Ativar scripts",
  ENABLE_ONLOAD_SCRIPTS_CONFIRM_DENY: "Não permitir",
  ENABLE_ONLOAD_SCRIPTS_DESC:
    "Se ativado, o Excalidraw executará código <code>excalidraw-onload-script</code> em nível de arquivo em todos os desenhos que você abrir de agora em diante, até desativar. Cria risco com markdown de fontes desconhecidas: um ator malicioso pode usar <code>excalidraw-onload-script</code> para executar qualquer comando no Obsidian e potencialmente transferir dados à internet. Ative apenas se confiar no arquivo e na fonte.",
  AUTOSTART_SCRIPT_PROMPT:
    "deseja rodar automaticamente toda vez que você abrir um desenho do Excalidraw. Deseja permitir isto?",
  AUTOSTART_SCRIPT_PROMPT_MANAGE_HINT:
    'Você pode alterar isto depois pela Paleta de Comandos ("Scripts de autoinicialização") ou em Configurações → Excalidraw Automate → Scripts de autoinicialização.',
  AUTOSTART_SCRIPT_ALLOW: "Início automático",
  AUTOSTART_SCRIPT_DENY: "Apenas início manual",
  AUTOSTART_SCRIPT_ASK_LATER: "Perguntar toda vez",
  AUTOSTART_SCRIPTS_HEAD: "Scripts de início automático",
  AUTOSTART_SCRIPTS_DESC:
    "Scripts aparecem aqui quando pedem permissão para rodar automaticamente a cada nova visualização do Excalidraw (rodar o script uma vez, manualmente, é o que dispara o pedido). Altere a configuração de um script a qualquer momento.",
  AUTOSTART_SCRIPTS_EMPTY:
    "Nenhum script solicitou permissão de início automático ainda.",
  AUTOSTART_SCRIPT_FAILED_WARNING:
    "Este script falhou na última tentativa de início automático.",
  ENABLE_COMMAND_LINKS_NAME: "Ativar links de comando (cmd://)",
  ENABLE_COMMAND_LINKS_CONFIRMATION:
    "Este link dispara um comando do Obsidian via <code>cmd://</code>. Deseja ativar links de comando?",
  ENABLE_COMMAND_LINKS_CONFIRM_ENABLE: "Ativar links de comando",
  ENABLE_COMMAND_LINKS_CONFIRM_DENY: "Não permitir",
  ENABLE_COMMAND_LINKS_DESC:
    "Se ativado, o Excalidraw permitirá links iniciados por <code>cmd://</code> para executar ações da paleta de comandos do Obsidian nos desenhos que você abrir de agora em diante, até desativar. Cria risco ao abrir desenhos de fontes desconhecidas: um desenho malicioso pode fazer um clique comum disparar comandos privilegiados. Ative apenas se confiar no arquivo e na fonte.",
  STARTUP_SCRIPT_NAME: "Script de inicialização",
  STARTUP_SCRIPT_JS_DISABLED:
    "Scripts de inicialização JavaScript estão desativados. Ative arquivos JavaScript nas configurações do Excalidraw Automate primeiro.",
  STARTUP_SCRIPT_DESC:
    "Se definido, o Excalidraw executará o script na inicialização do plugin. Útil para configurar hooks do Excalidraw Automate. Caminhos sem extensão usam um arquivo Markdown; arquivos <code>.js</code> são aceitos quando o carregamento de arquivos JavaScript está ativado.",
  STARTUP_SCRIPT_BUTTON_CREATE: "Criar script de inicialização",
  STARTUP_SCRIPT_BUTTON_OPEN: "Abrir script de inicialização",
  FILETYPE_NAME:
    "Exibir tipo (✏️) para arquivos excalidraw.md no explorador de arquivos",
  FILETYPE_DESC:
    "Arquivos do Excalidraw receberão um indicador com o emoji ou texto definido na próxima configuração.",
  FILETAG_NAME: "Definir o indicador de tipo para arquivos excalidraw.md",
  FILETAG_DESC: "O texto ou emoji a exibir como indicador de tipo.",
  INSERT_EMOJI: "Inserir um emoji",
  LIVEPREVIEW_NAME:
    "Embutimento imersivo de imagem no modo de edição live preview",
  LIVEPREVIEW_DESC:
    "Ative para suportar estilos de embutir imagem como ![[drawing|width|style]] no modo de edição de pré-visualização ao vivo. A configuração não afetará os documentos abertos no momento; feche e reabra para ter efeito.",
  FADE_OUT_EXCALIDRAW_MARKUP_NAME: "Desvanecer marcação do Excalidraw",
  FADE_OUT_EXCALIDRAW_MARKUP_DESC:
    "No modo de visualização markdown, a seção após o comentário %% desaparece gradualmente. O texto continua lá, mas a poluição visual é reduzida. Você pode colocar o %% na linha logo acima de # Text Elements; nesse caso todo o markdown do desenho desaparece, incluindo # Text Elements. O efeito colateral é não poder referenciar blocos de texto em outras notas após o %%. Raramente é um problema. Para editar o script markdown do Excalidraw, mude para o modo markdown e remova temporariamente o comentário %%.",
  EXCALIDRAW_PROPERTIES_NAME:
    "Carregar propriedades do Excalidraw no sugeridor do Obsidian",
  EXCALIDRAW_PROPERTIES_DESC:
    "Ative para carregar as propriedades de documento do Excalidraw no sugestor de propriedades do Obsidian na inicialização do plugin. Simplifica o uso de propriedades de frontmatter do Excalidraw. Se preferir não carregar automaticamente, desative, mas precisará remover manualmente propriedades indesejadas do sugestor. Ativar exige reiniciar o plugin, pois as propriedades são carregadas na inicialização.",
  FONTS_HEAD: "Fontes",
  FONTS_DESC:
    "Configure fontes locais e fontes CJK baixadas para o Excalidraw.",
  CUSTOM_FONT_HEAD: "Fonte local",
  ENABLE_FOURTH_FONT_NAME: "Ativar opção de fonte local",
  ENABLE_FOURTH_FONT_DESC:
    "Ativar adiciona uma fonte local à lista de fontes no painel de propriedades de elementos de texto. Fontes locais podem comprometer a independência de plataforma: arquivos podem renderizar diferente em outro vault ou no futuro, dependendo das configurações de fonte. A 4ª fonte usará a fonte do sistema no excalidraw.com ou outras versões.",
  FOURTH_FONT_NAME: "Arquivo de fonte local",
  FOURTH_FONT_DESC:
    "Selecione um arquivo de fonte .otf, .ttf, .woff ou .woff2 do seu vault como fonte local. Sem seleção, o Excalidraw usará a fonte Virgil. Para melhor desempenho, use .woff2: o Excalidraw codifica apenas os glifos necessários ao exportar SVG; outros formatos embutem a fonte inteira, gerando arquivos bem maiores.",
  OFFLINE_CJK_NAME: "Suporte a fonte CJK offline",
  OFFLINE_CJK_GROUP_DESC:
    "Baixe e pré-carregue seletivamente fontes chinesas, japonesas e coreanas para que o Excalidraw possa renderizá-las sem conexão com a internet.",
  OFFLINE_CJK_DESC: `<strong>Alterações aqui só terão efeito após reiniciar o Obsidian.</strong><br>O Excalidraw.com oferece fontes CJK manuscritas. Por padrão, não são incluídas localmente no plugin; são servidas da internet. Se prefere manter o Excalidraw totalmente local, sem dependência de internet, baixe os <a href="${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RAW_REFS_HEADS_MASTER_ASSETS_EXCALIDRAW_FONTS_ZIP}" target="_blank">arquivos de fonte do GitHub</a>. Após baixar, extraia o conteúdo para uma pasta do seu Vault.<br>Pré-carregar fontes afeta o desempenho da inicialização; por isso você pode selecionar quais fontes carregar.`,
  CJK_ASSETS_FOLDER_NAME: "Pasta de fontes CJK (SENsÍVEL a MAIÚSCULAS!)",
  CJK_ASSETS_FOLDER_DESC:
    'Defina aqui o local da pasta de fontes CJK; por exemplo, <code>Excalidraw/CJK Fonts</code>.<br><br><strong>Importante:</strong> não defina esta pasta como a raiz do Vault! Não coloque outras fontes nesta pasta.<br><br><strong>Nota:</strong> se usa Obsidian Sync e quer sincronizar essas fontes entre dispositivos, configure o Sync para "Todos os outros tipos de arquivo".',
  LOAD_CHINESE_FONTS_NAME:
    "Carregar fontes chinesas de arquivo na inicialização",
  LOAD_JAPANESE_FONTS_NAME:
    "Carregar fontes japonesas de arquivo na inicialização",
  LOAD_KOREAN_FONTS_NAME:
    "Carregar fontes coreanas de arquivo na inicialização",
  SCRIPT_SETTINGS_HEAD: "Configurações para scripts instalados",
  SCRIPT_SETTINGS_DESC:
    "Alguns scripts do Excalidraw Automate incluem configurações. As configurações são organizadas por script e só se tornam visíveis nesta lista depois de executar o script recém-baixado uma vez.",
  TASKBONE_HEAD: "Taskbone - Reconhecimento Óptico de Caracteres",
  TASKBONE_GROUP_DESC:
    "Configure o serviço opcional de OCR online Taskbone para extrair texto pesquisável de desenhos e imagens.",
  TASKBONE_DESC:
    "Integração experimental de reconhecimento óptico de caracteres (OCR) no Excalidraw. Note que o Taskbone é um serviço externo independente, não fornecido pelo Excalidraw nem pelo projeto do plugin Excalidraw-Obsidian. O serviço de OCR extrai texto legível de linhas de desenho livre e imagens embutidas no seu canvas e coloca o texto reconhecido no frontmatter do desenho e na área de transferência. Ter o texto no frontmatter permite buscar no Obsidian pelo conteúdo destes. Note que a extração não é local, mas via API online; o serviço armazena a imagem nos servidores dele apenas pelo tempo necessário. Se isto for impeditivo, não use o recurso.",
  TASKBONE_ENABLE_NAME: "Ativar Taskbone",
  TASKBONE_ENABLE_DESC: `Ao ativar este serviço, você concorda com os <a href="${URLs.WWW_TASKBONE_COM_LEGAL_TERMS}" target='_blank'>Termos e Condições</a> e a <a href="${URLs.WWW_TASKBONE_COM_LEGAL_PRIVACY}" target='_blank'>Política de Privacidade</a> do Taskbone.`,
  TASKBONE_APIKEY_NAME: "Chave de API do Taskbone",
  TASKBONE_APIKEY_DESC: `O Taskbone oferece um serviço gratuito com um número razoável de escaneamentos por mês. Se quiser usar mais frequentemente, ou apoiar o desenvolvedor do Taskbone (como imagina, não existe 'grátis'; este incrível serviço de OCR custa dinheiro ao desenvolvedor), você pode comprar uma chave de API paga em <a href="${URLs.WWW_TASKBONE_COM}" target='_blank'>taskbone.com</a>. Tendo comprado uma chave, simplesmente sobrescreva esta chave gratuita gerada automaticamente pela sua chave paga.`,
  HOTKEY_PRESS_COMBO_NANE: "Pressione sua combinação de atalho",
  HOTKEY_PRESS_COMBO_DESC: "Pressione a combinação de teclas desejada",
  HOTKEY_BUTTON_ADD_OVERRIDE: "Adicionar nova sobrescrita",
  HOTKEY_BUTTON_REMOVE: "Remover",
  SELECT_FILE: "Selecione um arquivo e pressione Enter.",
  SELECT_COMMAND: "Selecione um comando e pressione Enter.",
  SELECT_FILE_WITH_OPTION_TO_SCALE: `Selecione um arquivo e pressione ENTER, ou ${labelSHIFT()}+${labelMETA()}+ENTER para inserir em escala de 100%.`,
  NO_MATCH: "Nenhum arquivo corresponde à sua busca.",
  NO_MATCHING_COMMAND: "Nenhum comando corresponde à sua busca.",
  SELECT_FILE_TO_LINK: "Selecione o arquivo para o qual deseja inserir o link.",
  SELECT_COMMAND_PLACEHOLDER:
    "Selecione o comando para o qual deseja inserir o link.",
  SELECT_DRAWING: "Selecione a imagem ou desenho que deseja inserir",
  TYPE_FILENAME: "Digite o nome do desenho para selecionar.",
  SELECT_FILE_OR_TYPE_NEW:
    "Selecione um desenho existente ou digite o nome de um novo desenho e pressione Enter.",
  SELECT_TO_EMBED: "Selecione o desenho a inserir no documento ativo.",
  SELECT_MD: "Selecione o documento markdown que deseja inserir",
  TYPE_SECTION: "Digite o nome da seção para selecionar.",
  SELECT_SECTION_OR_TYPE_NEW:
    "Selecione uma seção existente ou digite o nome de uma nova seção e pressione Enter.",
  INVALID_SECTION_NAME: "Nome de seção inválido.",
  EMPTY_SECTION_MESSAGE:
    "Digite o nome da seção e pressione Enter para criar uma nova seção",
  INFINITE_LOOP_WARNING:
    "AVISO DO EXCALIDRAW\\nCarregamento de imagens embutidas abortado devido a loop infinito no arquivo:\\n",
  SCRIPT_EXECUTION_ERROR:
    "Erro de execução de script. Encontre a mensagem de erro no console do desenvolvedor.",
  SCRIPT_INSTALLED_NOTICE: "Instalado",
  SCRIPT_INSTALL_ERROR_NOTICE: "Erro ao instalar script",
  SCRIPT_STORE_TITLE: "Scripts da comunidade",
  SCRIPT_STORE_LOADING: "Carregando scripts da comunidade...",
  SCRIPT_STORE_MASTERY_TITLE: "Excalidraw Mastery",
  SCRIPT_STORE_MASTERY_DESC: "Domine o Excalidraw e o PKM Visual",
  SCRIPT_STORE_COFFEE_TITLE: "Pague um café",
  SCRIPT_STORE_COFFEE_DESC: "Apoie o desenvolvimento contínuo do Excalidraw",
  SCRIPT_STORE_SCRIPTING_BANNER_ALT:
    "Automatize tudo com scripts do Excalidraw",
  SCRIPT_STORE_SCRIPTING_BANNER_CAPTION:
    "Crie seus próprios scripts do Excalidraw. Clique aqui para saber mais.",
  SCRIPT_STORE_UPDATES_TITLE: "Atualizações disponíveis",
  SCRIPT_STORE_UPDATES_DESC:
    "Atualize os scripts da comunidade instalados sem precisar caçar no catálogo.",
  SCRIPT_STORE_UPDATE_ALL: "Atualizar tudo",
  SCRIPT_STORE_UPDATING: "Atualizando...",
  SCRIPT_STORE_UPDATE_ALL_DONE:
    "Todos os scripts da comunidade estão atualizados.",
  SCRIPT_STORE_UPDATE_ALL_PARTIAL:
    "Alguns scripts não puderam ser atualizados. Falhas:",
  SCRIPT_STORE_BROWSE_TITLE: "Explorar scripts",
  SCRIPT_STORE_BROWSE_DESC: "Busque por nome, autor, descrição ou categoria.",
  SCRIPT_STORE_SEARCH_PLACEHOLDER: "Buscar scripts da comunidade",
  SCRIPT_STORE_CATEGORY_LABEL: "Categoria do script",
  SCRIPT_STORE_ALL_CATEGORIES: "Todas as categorias",
  SCRIPT_STORE_ALL_SCRIPTS: "Todos",
  SCRIPT_STORE_INSTALLED_SCRIPTS: "Instalados",
  SCRIPT_STORE_RESULTS: "scripts",
  SCRIPT_STORE_NO_RESULTS: "Nenhum script encontrado",
  SCRIPT_STORE_NO_RESULTS_DESC: "Tente outra busca ou categoria.",
  SCRIPT_STORE_DETAILS: "Detalhes do script",
  SCRIPT_STORE_FEATURED: "Destacado",
  SCRIPT_STORE_BY: "Por",
  SCRIPT_STORE_UPDATE_BADGE: "Atualizar",
  SCRIPT_STORE_INSTALLED_BADGE: "Instalado",
  SCRIPT_STORE_CHECK_FAILED: "Falha na verificação",
  SCRIPT_STORE_INSTALL: "Instalar",
  SCRIPT_STORE_UPDATE: "Atualizar",
  SCRIPT_STORE_REINSTALL: "Reinstalar",
  SCRIPT_STORE_BACK: "Voltar para scripts",
  SCRIPT_STORE_VIEW_SOURCE: "Ver código-fonte",
  SCRIPT_STORE_LOCAL_TITLE: "Script instalado",
  SCRIPT_STORE_MULTIPLE_COPIES:
    "Várias cópias gerenciadas encontradas. As verificações de atualização usam a primeira cópia abaixo. Você pode abrir, mover ou desinstalar as outras.",
  SCRIPT_STORE_PRIMARY_COPY: "Usada para verificações de atualização",
  SCRIPT_STORE_ADDITIONAL_COPY: "Cópia adicional",
  SCRIPT_STORE_LOCAL_FILE: "Arquivo local",
  SCRIPT_STORE_OPEN_LOCAL: "Abrir arquivo local",
  SCRIPT_STORE_OPEN_LOCAL_FAILED:
    "Não foi possível abrir o arquivo do script local.",
  SCRIPT_STORE_JS_OPEN_NOTE:
    "Arquivos JavaScript não são editáveis no Obsidian por padrão. Se nenhum plugin oferecer um editor de .js, abrir este arquivo não fará nada. Abra-o com um editor externo se precisar modificá-lo.",
  SCRIPT_STORE_UNINSTALL: "Desinstalar",
  SCRIPT_STORE_UNINSTALLED: "Desinstalado",
  SCRIPT_STORE_UNINSTALL_FAILED: "Não foi possível desinstalar",
  SCRIPT_STORE_GROUP_LABEL: "Grupo do script",
  SCRIPT_STORE_GROUP_ROOT: "Sem grupo (Downloaded)",
  SCRIPT_STORE_NEW_GROUP_PLACEHOLDER: "Novo nome de grupo",
  SCRIPT_STORE_MOVE_TO_GROUP: "Mover",
  SCRIPT_STORE_MOVED_TO_GROUP: "Script movido",
  SCRIPT_STORE_MOVE_FAILED: "Não foi possível mover o script",
  SCRIPT_INSTALL_PROMPT_FETCH_ERROR:
    "Erro ao abrir a página da Loja de Scripts do Excalidraw. Verifique se você consegue acessar o site. Registrei o link no console de desenvolvedor (pressione CTRL+SHIFT+i)",
  SCRIPT_INSTALL_PROMPT_OPEN_ERROR:
    "Não foi possível abrir o repositório do Script Engine",
  MARKER_FRAME_RENDERING_DISABLED_NOTICE:
    "Há frames de marcador ocultos na cena.",
  FONT_LOAD_SLOW:
    "Carregando fontes...\\n\\n Isto está demorando mais que o esperado. Se esse atraso ocorrer com frequência, baixe as fontes localmente para o seu Vault. \\n\\n(clique=dispensar, clique-direito=Informações)",
  FONT_INFO_TITLE: "A partir da v2.5.3 as fontes carregam da internet",
  FONT_INFO_DETAILED: `<p>
Para melhorar o tempo de inicialização e gerenciar a grande <strong>família de fontes CJK</strong>, movi as fontes CJK para fora do <code>main.js</code> do plugin. Por padrão, serão carregadas da internet; isto normalmente não causa problemas, pois o Obsidian as coloca em cache após o primeiro uso.
</p>
<p>
Se prefere manter o Obsidian 100% local ou enfrenta problemas de desempenho, baixe os ativos de fontes.
</p>
<h3>Instruções:</h3>
<ol>
<li>Baixe as fontes do <a href="${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RAW_REFS_HEADS_MASTER_ASSETS_EXCALIDRAW_FONTS_ZIP}">GitHub</a>.</li>
<li>Extraia e copie os arquivos para uma pasta do Vault (padrão: <code>Excalidraw/${CJK_FONTS}</code>; nomes de pasta diferenciam maiúsculas).</li>
<li><mark>NÃO</mark> defina esta pasta como a raiz do Vault nem misture com outras fontes locais.</li>
</ol>
<h3>Para usuários do Obsidian Sync:</h3>
<p>
Certifique-se de que o Obsidian Sync está configurado para sincronizar "Todos os outros tipos de arquivo", ou baixe e extraia o arquivo em todos os dispositivos.
</p>
<h3>Nota:</h3>
<p>
Se achar este processo trabalhoso, envie um pedido de recurso ao Obsidian.md pedindo suporte a ativos na pasta do plugin. Atualmente só um único <code>main.js</code> é suportado, o que leva a arquivos grandes e inicialização lenta para plugins complexos como o Excalidraw. Peço desculpas pela inconveniência.
</p>
`,
  GOTO_FULLSCREEN: "Ir para modo tela cheia",
  EXIT_FULLSCREEN: "Sair do modo tela cheia",
  TOGGLE_FULLSCREEN: "Alternar modo tela cheia",
  TOGGLE_DISABLEBINDING:
    "Alternar para inverter comportamento padrão de vinculação",
  TOGGLE_FRAME_RENDERING: "Alternar renderização de frames",
  TOGGLE_FRAME_CLIPPING: "Alternar recorte de frames",
  OPEN_LINK_CLICK: "Abrir link",
  OPEN_LINK_PROPS: "Abrir o editor de link-de-imagem ou fórmula LaTeX",
  NARROW_TO_HEADING: "Restringir ao título...",
  PIN_VIEW: "Fixar visualização",
  DO_NOT_PIN_VIEW: "Não fixar visualização",
  NARROW_TO_BLOCK: "Restringir ao bloco...",
  SHOW_ENTIRE_FILE: "Mostrar arquivo inteiro",
  SELECT_SECTION: "Selecionar seção do documento",
  SELECT_VIEW: "Selecionar visualização da base",
  ZOOM_TO_FIT: "Ajustar zoom",
  RELOAD: "Recarregar link original",
  OPEN_IN_BROWSER: "Abrir link atual no navegador",
  PROPERTIES: "Propriedades",
  COPYCODE: "Copiar fonte para a área de transferência",
  ES_TITLE: "Configurações do elemento embutível",
  ES_RENAME: "Renomear arquivo",
  ES_ZOOM: "Escala de conteúdo embutido",
  ES_YOUTUBE_START: "Tempo de início do YouTube",
  ES_YOUTUBE_START_DESC: "ss, mm:ss, hh:mm:ss",
  ES_YOUTUBE_START_INVALID:
    "O tempo de início do YouTube é inválido. Verifique o formato e tente novamente",
  ES_FILENAME_VISIBLE: "Nome de arquivo visível",
  ES_LOCKED_READING_MODE_HEAD: "Modo de leitura bloqueado",
  ES_LOCKED_READING_MODE_DESC:
    "Quando ativado, interagir com o embutível markdown não o alternará para o modo de edição. Útil para checklists e acompanhadores de hábitos.",
  LOCK_READING_MODE: "Bloquear modo de leitura",
  UNLOCK_READING_MODE: "Desbloquear modo de leitura",
  ES_BACKGROUND_HEAD: "Cor de fundo da nota embutida",
  ES_BACKGROUND_DESC_INFO: "Clique aqui para mais informações sobre cores",
  ES_BACKGROUND_DESC_DETAIL:
    "A cor de fundo afeta apenas o modo de pré-visualização do embutível markdown. Ao editar, segue o tema claro/escuro do Obsidian conforme a cena (via propriedade de documento) ou as configurações do plugin. A cor de fundo tem duas camadas: a cor de fundo do elemento (camada inferior) e uma cor por cima (camada superior). Selecionar 'Igual ao Fundo do Elemento' faz ambas seguirem a cor do elemento. Selecionar 'Igual ao Canvas' ou uma cor específica mantém a camada de fundo do elemento. Definir opacidade (ex.: 50%) mistura a cor do canvas/selecionada com a cor de fundo do elemento. Para remover a camada de fundo do elemento, defina a cor do elemento como transparente no editor de propriedades; só a camada superior terá efeito.",
  ES_BACKGROUND_MATCH_ELEMENT: "Correspondente à cor de fundo do elemento",
  ES_BACKGROUND_MATCH_CANVAS: "Correspondente à cor de fundo do canvas",
  ES_BACKGROUND_COLOR: "Cor de fundo",
  ES_BORDER_HEAD: "Cor de borda da nota embutida",
  ES_BORDER_COLOR: "Cor de borda",
  ES_BORDER_MATCH_ELEMENT: "Correspondente à cor de borda do elemento",
  ES_BACKGROUND_OPACITY: "Opacidade do fundo",
  ES_BORDER_OPACITY: "Opacidade da borda",
  ES_EMBEDDABLE_SETTINGS: "Configurações de markdown embutível",
  ES_USE_OBSIDIAN_DEFAULTS: "Usar padrões do Obsidian",
  ES_ZOOM_100_RELATIVE_DESC:
    "O botão ajustará a escala do elemento para que o conteúdo seja exibido a 100% em relação ao nível de zoom atual do seu canvas",
  ES_ZOOM_100: "100% relativo",
  ES_PROPERTIES_VISIBLE_HEAD: "Propriedades visíveis",
  ES_PROPERTIES_VISIBLE_DESC:
    "Mostra propriedades do documento (frontmatter YAML) no topo do arquivo embutido.",
  ES_PROPERTIES_VISIBLE_WARNING:
    "As configurações globais do Obsidian estão ocultando as propriedades do documento. Esta configuração não pode revelá-las. Primeiro altere suas configurações do Obsidian para 'Visível' ou 'Fonte'.",
  SHOW_PROPERTIES: "Mostrar propriedades",
  HIDE_PROPERTIES: "Ocultar propriedades",
  PROMPT_FILE_DOES_NOT_EXIST: "O arquivo não existe. Deseja criá-lo?",
  PROMPT_ERROR_NO_FILENAME: "Erro: o nome do novo arquivo não pode ficar vazio",
  PROMPT_ERROR_DRAWING_CLOSED:
    "Erro desconhecido. Parece que seu desenho foi fechado ou o arquivo do desenho está ausente",
  PROMPT_TITLE_NEW_FILE: "Novo arquivo",
  PROMPT_TITLE_CONFIRMATION: "Confirmação",
  PROMPT_BUTTON_CREATE_EXCALIDRAW: "Criar EX",
  PROMPT_BUTTON_CREATE_EXCALIDRAW_ARIA:
    "Criar desenho do Excalidraw e abrir em nova aba",
  PROMPT_BUTTON_CREATE_MARKDOWN: "Criar MD",
  PROMPT_BUTTON_CREATE_MARKDOWN_ARIA:
    "Criar documento markdown e abrir em nova aba",
  PROMPT_BUTTON_EMBED_MARKDOWN: "Embutir MD",
  PROMPT_BUTTON_EMBED_MARKDOWN_ARIA:
    "Substituir elemento selecionado por documento markdown embutido",
  PROMPT_BUTTON_NEVERMIND: "Deixa pra lá",
  PROMPT_BUTTON_OK: "OK",
  PROMPT_BUTTON_CANCEL: "Cancelar",
  PROMPT_BUTTON_CLOSE: "Fechar",
  PROMPT_BUTTON_INSERT_LINE: "Inserir nova linha",
  PROMPT_BUTTON_INSERT_SPACE: "Inserir espaço",
  PROMPT_BUTTON_INSERT_LINK: "Inserir link markdown para arquivo",
  PROMPT_BUTTON_UPPERCASE: "Maiúsculas",
  PROMPT_BUTTON_SPECIAL_CHARS: "Caracteres especiais",
  PROMPT_SELECT_TEMPLATE: "Selecione um template",
  LATEX_SUITE_PLUGIN_SUGGESTION:
    "Instale o plugin 'Latex Suite' dos Plugins Comunitários do Obsidian para ativar a pré-visualização ao vivo enquanto digita sua equação.",
  WEB_BROWSER_DRAG_ACTION: "Ação de arrastar do navegador web",
  LOCAL_FILE_DRAG_ACTION: "Ação de arrastar arquivo local do SO",
  INTERNAL_DRAG_ACTION: "Ação de arrastar interno do Obsidian",
  PANE_TARGET: "Comportamento de clique em link",
  DEFAULT_ACTION_DESC:
    "Caso nenhuma das combinações se aplique, a ação padrão para este grupo é: ",
  FRAME_SETTINGS_TITLE: "Configurações de frame",
  FRAME_SETTINGS_ENABLE: "Ativar frames",
  FRAME_SETTIGNS_NAME: "Exibir nome do frame",
  FRAME_SETTINGS_OUTLINE: "Exibir contorno do frame",
  FRAME_SETTINGS_CLIP: "Ativar recorte de frame",
  IPM_PAGES_TO_IMPORT_NAME: "Páginas a importar",
  IPM_PAGES_TO_IMPORT_DESC: "Ex.: 1,3-5,7,9-10",
  IPM_SELECT_PAGES_TO_IMPORT: "Selecione as páginas a importar",
  IPM_ADD_BORDER_BOX_NAME: "Adicionar caixa de borda",
  IPM_ADD_FRAME_NAME: "Adicionar página ao frame",
  IPM_ADD_FRAME_DESC:
    "Para facilitar o manuseio, recomendo travar a página dentro do quadro. Se travar a página dentro do quadro, a única forma de destravá-la será clicar com o botão direito no quadro, selecionar remover elementos do quadro e, então, destravar a página.",
  IPM_GROUP_PAGES_NAME: "Agrupar páginas",
  IPM_GROUP_PAGES_DESC:
    "Isto agrupará todas as páginas num único grupo. Recomendado se você travar as páginas após a importação, porque o grupo será mais fácil de destravar depois do que destravar uma a uma.",
  IPM_SELECT_PDF: "Selecione um arquivo PDF",
  UPDATE_AVAILABLE: `Uma versão mais recente do Excalidraw está disponível nos Plugins Comunitários.\n\nVocê está usando ${PLUGIN_VERSION}.\nA mais recente é`,
  SCRIPT_UPDATES_AVAILABLE: `Atualizações de scripts disponíveis - veja a loja de scripts.\n\n${DEVICE.isDesktop ? `Esta mensagem está disponível no console.log (${DEVICE.isMacOS ? "CMD+OPT+i" : "CTRL+SHIFT+i"})\n\n` : ""}Se organizou scripts em subpastas da loja e tem múltiplas cópias do mesmo script, pode ser preciso limpar versões não usadas para limpar este alerta. Cópias privadas que não devem ser atualizadas devem ficar fora da pasta da loja.`,
  ERROR_PNG_TOO_LARGE:
    "Erro ao exportar PNG - PNG grande demais, tente uma resolução menor",
  WEB_DRAG_IMPORT_IMAGE: "Importar imagem para o vault",
  WEB_DRAG_IMAGE_URL: "Inserir imagem ou thumbnail do YouTube com URL",
  WEB_DRAG_LINK: "Inserir link",
  WEB_DRAG_EMBEDDABLE: "Inserir frame interativo",
  LOCAL_DRAG_IMPORT:
    "Importar arquivo externo ou reutilizar arquivo existente se o caminho for do vault",
  LOCAL_DRAG_IMAGE: "Inserir imagem: com URI local ou link interno se do vault",
  LOCAL_DRAG_LINK: "Inserir link: URI local ou link interno se do vault",
  LOCAL_DRAG_EMBEDDABLE:
    "Inserir frame interativo: URI local ou link interno se do vault",
  INTERNAL_DRAG_IMAGE: "Inserir imagem",
  INTERNAL_DRAG_IMAGE_FULL: "Inserir imagem @100%",
  INTERNAL_DRAG_LINK: "Inserir link",
  INTERNAL_DRAG_EMBEDDABLE: "Inserir frame interativo",
  LINK_CLICK_ACTIVE: "Abrir na janela ativa atual",
  LINK_CLICK_NEW_PANE: "Abrir em uma nova janela adjacente",
  LINK_CLICK_POPOUT: "Abrir em uma janela flutuante",
  LINK_CLICK_NEW_TAB: "Abrir em uma nova aba",
  LINK_CLICK_MD_PROPS:
    "Mostrar o diálogo de propriedades da imagem Markdown (relevante apenas se você embutiu um documento markdown como imagem)",
  EXPORTDIALOG_TITLE: "Exportar desenho",
  EXPORTDIALOG_TAB_IMAGE: "Imagem",
  EXPORTDIALOG_TAB_PDF: "PDF",
  EXPORTDIALOG_SAVE_SETTINGS:
    "Salvar configurações de imagem nas doc.properties do arquivo?",
  EXPORTDIALOG_SAVE_SETTINGS_SAVE: "Salvar como preset",
  EXPORTDIALOG_SAVE_SETTINGS_ONETIME: "Uso único",
  EXPORTDIALOG_IMAGE_SETTINGS: "Imagem",
  EXPORTDIALOG_IMAGE_DESC:
    "PNG suporta transparência. Arquivos externos podem incluir dados de cena do Excalidraw.",
  EXPORTDIALOG_PADDING: "Margem",
  EXPORTDIALOG_SCALE: "Escala",
  EXPORTDIALOG_CURRENT_PADDING: "Margem atual:",
  EXPORTDIALOG_SIZE_DESC: "A escala afeta o tamanho da saída",
  EXPORTDIALOG_SCALE_VALUE: "Escala:",
  EXPORTDIALOG_IMAGE_SIZE: "Tamanho:",
  EXPORTDIALOG_EXPORT_THEME: "Tema",
  EXPORTDIALOG_THEME_LIGHT: "Claro",
  EXPORTDIALOG_THEME_DARK: "Escuro",
  EXPORTDIALOG_BACKGROUND: "Fundo",
  EXPORTDIALOG_BACKGROUND_TRANSPARENT: "Transparente",
  EXPORTDIALOG_BACKGROUND_USE_COLOR: "Usar cor da cena",
  EXPORTDIALOG_INCLUDE_INTERNAL_LINKS: "Exportar links internos para SVG/PDF?",
  EXPORTDIALOG_SELECTED_ELEMENTS: "Exportar",
  EXPORTDIALOG_SELECTED_ALL: "Cena inteira",
  EXPORTDIALOG_SELECTED_SELECTED: "Apenas seleção",
  EXPORTDIALOG_EMBED_SCENE: "Incluir dados da cena?",
  EXPORTDIALOG_EMBED_YES: "Sim",
  EXPORTDIALOG_EMBED_NO: "Não",
  EXPORTDIALOG_PDF_SETTINGS: "PDF",
  EXPORTDIALOG_PAGE_SIZE: "Tamanho",
  EXPORTDIALOG_PAGE_ORIENTATION: "Orientação",
  EXPORTDIALOG_ORIENTATION_PORTRAIT: "Retrato",
  EXPORTDIALOG_ORIENTATION_LANDSCAPE: "Paisagem",
  EXPORTDIALOG_PDF_FIT_TO_PAGE: "Ajuste à página",
  EXPORTDIALOG_PDF_FIT_OPTION: "Ajustar à página",
  EXPORTDIALOG_PDF_FIT_2_OPTION: "Ajustar a máx. 2 páginas",
  EXPORTDIALOG_PDF_FIT_4_OPTION: "Ajustar a máx. 4 páginas",
  EXPORTDIALOG_PDF_FIT_6_OPTION: "Ajustar a máx. 6 páginas",
  EXPORTDIALOG_PDF_FIT_8_OPTION: "Ajustar a máx. 8 páginas",
  EXPORTDIALOG_PDF_FIT_12_OPTION: "Ajustar a máx. 12 páginas",
  EXPORTDIALOG_PDF_FIT_16_OPTION: "Ajustar a máx. 16 páginas",
  EXPORTDIALOG_PDF_SCALE_OPTION:
    "Usar escala da imagem (pode ocupar várias páginas)",
  EXPORTDIALOG_PDF_PAPER_COLOR: "Cor do papel",
  EXPORTDIALOG_PDF_PAPER_WHITE: "Branco",
  EXPORTDIALOG_PDF_PAPER_SCENE: "Usar cor da cena",
  EXPORTDIALOG_PDF_PAPER_CUSTOM: "Cor personalizada",
  EXPORTDIALOG_PDF_ALIGNMENT: "Posição na página",
  EXPORTDIALOG_PDF_ALIGN_CENTER: "Centro",
  EXPORTDIALOG_PDF_ALIGN_CENTER_LEFT: "Centro-esquerda",
  EXPORTDIALOG_PDF_ALIGN_CENTER_RIGHT: "Centro-direita",
  EXPORTDIALOG_PDF_ALIGN_TOP_LEFT: "Superior-esquerda",
  EXPORTDIALOG_PDF_ALIGN_TOP_CENTER: "Superior-centro",
  EXPORTDIALOG_PDF_ALIGN_TOP_RIGHT: "Superior-direita",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_LEFT: "Inferior-esquerda",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_CENTER: "Inferior-centro",
  EXPORTDIALOG_PDF_ALIGN_BOTTOM_RIGHT: "Inferior-direita",
  EXPORTDIALOG_PDF_MARGIN: "Margem",
  EXPORTDIALOG_PDF_MARGIN_NONE: "Nenhuma",
  EXPORTDIALOG_PDF_MARGIN_TINY: "Pequena",
  EXPORTDIALOG_PDF_MARGIN_NORMAL: "Normal",
  EXPORTDIALOG_SAVE_PDF_SETTINGS: "Salvar configurações de PDF",
  EXPORTDIALOG_SAVE_CONFIRMATION:
    "Configuração de PDF salva nas configurações do plugin como padrão",
  EXPORTDIALOG_PNGTOFILE: "Exportar PNG",
  EXPORTDIALOG_SVGTOFILE: "Exportar SVG",
  EXPORTDIALOG_PNGTOVAULT: "PNG para o vault",
  EXPORTDIALOG_SVGTOVAULT: "SVG para o vault",
  EXPORTDIALOG_EXCALIDRAW: "Excalidraw",
  EXPORTDIALOG_PNGTOCLIPBOARD: "PNG para a área de transferência",
  EXPORTDIALOG_SVGTOCLIPBOARD: "SVG para a área de transferência",
  EXPORTDIALOG_PDF: "Exportar PDF",
  EXPORTDIALOG_PDF_PROGRESS_NOTICE:
    "Exportando PDF. Se esta imagem for grande, pode demorar um pouco.",
  EXPORTDIALOG_PDF_PROGRESS_DONE: "Exportação concluída",
  EXPORTDIALOG_PDF_PROGRESS_ERROR:
    "Erro ao exportar PDF, veja o console do desenvolvedor para detalhes",
  EXPORTDIALOG_NOT_AVAILALBE:
    "Desculpe, este recurso está disponível apenas quando o desenho está aberto no workspace principal do Obsidian.",
  EXPORTDIALOG_TAB_SCREENSHOT: "Captura de tela",
  EXPORTDIALOG_SCREENSHOT_DESC:
    "Capturas de tela incluirão embutíveis como páginas markdown, YouTube, sites etc. Estão disponíveis apenas no desktop, não podem ser exportadas automaticamente e suportam apenas o formato PNG.",
  SCREENSHOT_DESKTOP_ONLY:
    "O recurso de captura de tela está disponível apenas no desktop",
  SCREENSHOT_ERROR: "Erro ao capturar screenshot - veja o log no console",
  PDF_EXPORT_DESKTOP_ONLY: "A exportação PDF está disponível apenas no desktop",
  UIFM_TITLE: "Inserir arquivo do vault",
  UIFM_SECTION_HEAD: "Selecione o título da seção",
  UIFM_ANCHOR: "Ancorar a 100% do tamanho original",
  UIFM_ANCHOR_DESC:
    "Recurso avançado; use apenas se entender como funciona. Se ativado, mesmo que você redimensione a imagem importada no Excalidraw, na próxima abertura do desenho ela voltará a 100%. Útil ao embutir uma ideia atômica do Excalidraw em outra nota preservando o dimensionamento relativo de texto e ícones.",
  UIFM_BTN_EMBEDDABLE: "como embutível",
  UIFM_BTN_PDF: "PDF como imagem",
  UIFM_BTN_IMAGE: "como imagem",
  RN_WELCOME: "Bem-vindo ao Excalidraw",
  FIRST_RUN: `O plugin Excalidraw para Obsidian é muito mais que uma ferramenta de desenho. Por integrar-se profundamente ao Obsidian, abre um novo paradigma para o Gerenciamento Visual de Conhecimento Pessoal.

<div style="text-align:center;margin-top:10px;">
<a href="${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EE}" target="_blank"><img src="${URLs.SKETCH_YOUR_MIND_COM_IMAGES_LOGO_EE_PNG}" style="width:50%;"></a>
</div>

Para começar sem sobrecarga, recomendo muito o mini-curso gratuito **[Excalidraw Essentials](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EE})**. Ele corta o ruído e ensina os fundamentos de forma rápida e estruturada.

Você também não precisa descobrir tudo sozinho! Junte-se à **[Comunidade Sketch Your Mind](${URLs.COMMUNITY_SKETCH_YOUR_MIND_COM})** para conectar-se a outros pensadores visuais, compartilhar fluxos e construir um PKM sem fricção.

Para ver o que é possível agora, aqui está uma vitrine dos recursos principais. Para acompanhar novidades e explorar o PKM visual, inscreva-se no meu canal: [Visual PKM](${URLs.WWW_YOUTUBE_COM_VISUALPKM}).

Obrigado e divirta-se!

<div class="excalidraw-videoWrapper">
<a href="${URLs.WWW_YOUTUBE_COM_WATCH}" target="_blank"><img src="${URLs.I_YTIMG_COM_VI_P_Q6AVJGOWI_MAXRESDEFAULT_JPG}" style="width:100%;"></a>
</div>
`,
  NOTICE_PDF_THEME:
    "Tema do PDF sobrescrito.\\nControle pela propriedade de documento 'excalidraw-embeddable-theme' deste arquivo (sobrescreve o plugin).\\n\\nValores: dark, light, auto=Excalidraw, default=Obsidian.",
  BOOKMARK_PAGE: "Salvar posição atual no documento",
  CAPTURE_PAGE: "Capturar página atual como imagem",
  VERSION_MISMATCH_NOTICE: `A versão registrada pelo Obsidian é <b>{VAL_RECORDED}</b>, mas o código do Excalidraw instalado é <b>{VAL_ACTUAL}</b>.`,
  VERSION_MISMATCH_HEADING: "Divergência de versão do Excalidraw",
  VERSION_MISMATCH_CAUSE:
    "Isto costuma ocorrer após uma sincronização parcial (ex.: Obsidian Sync Standard) em que arquivos grandes (main.js > 5MB) não sincronizaram, atualizando apenas o <code>manifest.json</code>.",
  VERSION_MISMATCH_OPTIONS:
    "Opções:<br><b>1.</b> Baixar o plugin novamente (recomendado).<br><b>2.</b> Ignorar por enquanto.",
  VERSION_MISMATCH_NOTE:
    "Nota: atualizar informações de versão manualmente pode afetar ferramentas que leem o manifest.json diretamente (ex.: Plugin Update Tracker, BRAT) até uma reinstalação completa.",
  VERSION_MISMATCH_DISABLE_NAME: "Desativar avisos futuros de divergência",
  VERSION_MISMATCH_DISABLE_DESC:
    "Você pode reativar isto em: Configurações → Excalidraw → Básico → Avisar sobre atualizações incompletas do plugin.",
  VERSION_MISMATCH_REDOWNLOAD: "Baixar plugin novamente",
  VERSION_MISMATCH_IGNORE: "Ignorar",
  INLINE_HINT: "Digite [[ para buscar e inserir um link",
  SUGGESTION_NOMATCH: "Nenhuma correspondência encontrada",
  EXTRAS_GATEWAY_COMP_MATHJAX: "MathJax (LaTeX)",
  EXTRAS_GATEWAY_COMP_MERMAID: "Mermaid para Excalidraw",
  EXTRAS_GATEWAY_COMP_PDF: "Exportação PDF",
  EXTRAS_GATEWAY_COMP_FILESYSTEM: "Acesso ao sistema de arquivos local",
  EXTRAS_GATEWAY_TITLE: "Excalidraw Extras necessário",
  EXTRAS_GATEWAY_DESC:
    "O recurso '{component}' foi movido para o plugin complementar Excalidraw Extras para manter o Excalidraw leve, respeitar as restrições de tamanho do Obsidian Sync Basic e lhe dar controle explícito sobre as bibliotecas adicionais e a funcionalidade de permissões elevadas que ele exige.",
  EXTRAS_GATEWAY_INSTALL_BTN: "Instalar dos Plugins Comunitários",
  EXTRAS_GATEWAY_MANUAL_ENABLE_NOTICE:
    "Eu havia implementado um fluxo mais suave que permitia ativar e desativar o Excalidraw Extras automaticamente quando necessário. Infelizmente, fui forçado a remover o recurso após ele ser sinalizado pelo scanner de código do Obsidian como problema de alto risco, com uma explicação automática que, acredito, não reflete com precisão o que o código faz. Ative o Excalidraw Extras manualmente em Plugins da comunidade. Se quiser uma experiência mais conveniente no futuro, considere contatar o Obsidian pedindo suporte amigável ao desenvolvedor de plugins para fluxos seguros de automação, incluindo gerenciamento de plugins complementares.",
  EXTRAS_GATEWAY_ENABLE_FEATURE_PERM_BTN: "Ativar {component} permanentemente",
  EXTRAS_GATEWAY_TEMP_ENABLE_TITLE: "Ativar temporariamente",
  EXTRAS_GATEWAY_TEMP_ENABLE_DESC:
    "Ativa o recurso temporariamente. Ele desligará automaticamente quando o temporizador expirar.",
  EXTRAS_GATEWAY_SESSION_ENABLE_DESC:
    "Ativar este recurso apenas para a sessão atual do Obsidian.",
  EXTRAS_GATEWAY_ENABLE_CURRENT_SESSION: "Ativar para esta sessão",
  EXTRAS_GATEWAY_FEATURE_TIMER_EXPIRED:
    "Excalidraw Extras: temporizador de {component} expirou. Recurso desativado.",
  EXTRAS_GATEWAY_API_MISSING:
    "Excalidraw Extras está ativado, mas a API falhou ao carregar. Atualize o plugin.",
  EXTRAS_GATEWAY_FEATURE_TITLE: "Recurso desativado",
  EXTRAS_GATEWAY_FEATURE_DESC:
    "O recurso '{component}' está desativado nas suas configurações do Excalidraw Extras.",
  EXTRAS_GATEWAY_IGNORE_SESSION: "Ignorar para esta sessão",
  EXTRAS_GATEWAY_UPDATE_EXACT:
    "Atualização do Excalidraw Extras necessária. {component} requer EXATAMENTE v{reqVersion} (encontrada v{currentVersion})",
  EXTRAS_GATEWAY_UPDATE_MIN:
    "Atualização do Excalidraw Extras necessária. {component} requer >= v{reqVersion} (encontrada v{currentVersion})",
  EXTRAS_GATEWAY_COMP_PLUGIN: "Plugin Excalidraw Extras",
  EXTRAS_GATEWAY_UPDATE_TITLE:
    "O Excalidraw requer uma nova versão do plugin Extras",
  EXTRAS_GATEWAY_UPDATE_BTN: "Abrir Plugins Comunitários",
  PEN_SETTINGS_TITLE: "Configurações de caneta",
  PEN_SETTINGS_HEADING: "Configurações de caneta",
  PEN_SETTINGS_TYPE_NAME: "Tipo de caneta",
  PEN_SETTINGS_TYPE_DESC: "Selecione o tipo de caneta",
  PEN_SETTINGS_TYPE_DEFAULT: "Padrão do Excalidraw",
  PEN_SETTINGS_TYPE_HIGHLIGHTER: "Marca-texto",
  PEN_SETTINGS_TYPE_FINETIP: "Caneta de ponta fina",
  PEN_SETTINGS_TYPE_FOUNTAIN: "Caneta-tinteiro",
  PEN_SETTINGS_TYPE_MARKER: "Marcador com contorno",
  PEN_SETTINGS_TYPE_THICK_THIN: "Mapa mental grosso-fino",
  PEN_SETTINGS_TYPE_THIN_THICK_THIN: "Mapa mental fino-grosso-fino",
  PEN_SETTINGS_APPLY: "Aplicar novo template",
  PEN_SETTINGS_SCOPE_FREEDRAW_ONLY:
    "Traço e preenchimento aplicam-se a: <b>apenas Freedraw</b>",
  PEN_SETTINGS_SCOPE_ALL_SHAPES:
    "Traço e preenchimento aplicam-se a: <b>todos os formatos</b>",
  PEN_SETTINGS_SCOPE_DESC: `<b>"Todas as formas"</b> significa que, se você selecionar uma caneta azul com preenchimento tracejado e trocar para outra ferramenta (linha, círculo, seta — isto é, não a ferramenta de desenho livre), todas terão a mesma linha azul e preenchimento tracejado.<br><b>"Aplica-se apenas à linha de desenho livre"</b> significa que, se você está escrevendo texto preto e seleciona uma caneta personalizada (ex.: marca-texto amarelo), ao trocar de ferramenta depois, as configurações anteriores (ex.: traço preto) se aplicam à nova forma.`,
  PEN_SETTINGS_STROKE_CURRENT: "Cor do traço: <b>atual</b>",
  PEN_SETTINGS_STROKE_PRESET: "Cor do traço: <b>cor predefinida</b>",
  PEN_SETTINGS_STROKE_DESC:
    "Use a cor de traço <b>atual</b> do canvas, ou defina uma <b>cor predefinida</b> específica para a caneta",
  PEN_SETTINGS_STROKE_SELECT: "Selecionar cor do traço",
  PEN_SETTINGS_USE_CANVAS_CURRENT: "Usar atual do canvas",
  PEN_SETTINGS_BG_CURRENT: "Cor de fundo: <b>atual</b>",
  PEN_SETTINGS_BG_PRESET: "Cor de fundo: <b>cor predefinida</b>",
  PEN_SETTINGS_BG_DESC:
    "Alterne para usar a <b>cor de fundo atual</b> do canvas; ou uma <b>cor predefinida</b>",
  PEN_SETTINGS_BG_TRANSPARENT: "Fundo: <b>transparente</b>",
  PEN_SETTINGS_BG_COLOR_PRESET: "Cor: <b>cor predefinida</b>",
  PEN_SETTINGS_BG_TRANSPARENT_DESC: "O fundo tem cor ou é transparente",
  PEN_SETTINGS_BG_COLOR: "Cor de fundo",
  PEN_SETTINGS_FILL_STYLE: "Estilo de preenchimento",
  PEN_SETTINGS_FILL_UNSET: "Não definido",
  PEN_SETTINGS_FILL_DOTS:
    "Pontos (⚠ desempenho MUITO LENTO em objetos grandes!)",
  PEN_SETTINGS_FILL_ZIGZAG: "Zigue-zague",
  PEN_SETTINGS_FILL_ZIGZAG_LINE: "Linha zigue-zague",
  PEN_SETTINGS_FILL_DASHED: "Tracejado",
  PEN_SETTINGS_FILL_HACHURE: "Hachura",
  PEN_SETTINGS_FILL_CROSS_HATCH: "Hachura cruzada",
  PEN_SETTINGS_FILL_SOLID: "Sólido",
  PEN_SETTINGS_SLOPPINESS: "Desleixo:",
  PEN_SETTINGS_NOT_SET: "Não definido",
  PEN_SETTINGS_SLOPPINESS_ARCHITECT: "Arquiteto",
  PEN_SETTINGS_SLOPPINESS_ARTIST: "Artista",
  PEN_SETTINGS_SLOPPINESS_CARTOONIST: "Cartunista",
  PEN_SETTINGS_SLOPPINESS_DESC:
    "Desleixo das linhas do padrão de preenchimento do formato",
  PEN_SETTINGS_STROKE_WIDTH: "Espessura do traço",
  PEN_SETTINGS_STROKE_PRESET_UNSET: "---",
  PEN_SETTINGS_STROKE_PRESET_EXTRA_THIN: "Extra fino",
  PEN_SETTINGS_STROKE_PRESET_THIN: "Fino",
  PEN_SETTINGS_STROKE_PRESET_MEDIUM: "Médio",
  PEN_SETTINGS_STROKE_PRESET_BOLD: "Grosso",
  PEN_SETTINGS_STROKE_PRESET_EXTRA_BOLD: "Extra grosso",
  PEN_SETTINGS_HIGHLIGHTER: "Caneta marca-texto?",
  PEN_SETTINGS_PRESSURE: "Caneta sensível à pressão?",
  PEN_SETTINGS_PRESSURE_DESC:
    "<b>ativado</b>: sensível à pressão<br><b>desativado</b>: pressão constante",
  PEN_SETTINGS_OUTLINE_NONE: "Sem contorno",
  PEN_SETTINGS_OUTLINE_WIDTH: "Espessura do contorno",
  PEN_SETTINGS_OUTLINE_DESC:
    "Se o traço tem contorno, a cor do traço é a cor do contorno e a cor de fundo é a cor de preenchimento do traço da caneta. Sem contorno, a cor da caneta é a cor do traço. A configuração de Estilo de Preenchimento aplica-se à forma fechada, não à linha em si, que só pode ter preenchimento sólido.",
  PEN_SETTINGS_PF_HEADING: "Configurações do Perfect Freehand",
  PEN_SETTINGS_PF_DOCS: `Leia a documentação do Perfect Freehand em <a href="${URLs.GITHUB_COM_STEVERUIZOK_PERFECT_FREEHAND}" target="_blank">este link</a>.`,
  PEN_SETTINGS_PF_THINNING: "Afinamento",
  PEN_SETTINGS_PF_THINNING_DESC: `O efeito da pressão no tamanho do traço.<br>Para criar um traço de linha estável, defina a opção de afinamento como 0.<br>Para criar um traço que afina com a pressão em vez de engrossar, use um número negativo para a opção de afinamento.`,
  PEN_SETTINGS_PF_SMOOTHING: "Suavização",
  PEN_SETTINGS_PF_SMOOTHING_DESC: "Quanto suavizar as bordas do traço.",
  PEN_SETTINGS_PF_STREAMLINE: "Encadeamento",
  PEN_SETTINGS_PF_STREAMLINE_DESC: "Quanto encadear o traço.",
  PEN_SETTINGS_EASING: "Função de easing",
  PEN_SETTINGS_EASING_DESC: `Uma função de easing para o efeito de afunilamento. Para mais informações <a href="${URLs.EASINGS_NET}" target="_blank">clique aqui</a>`,
  PEN_SETTINGS_SIMULATE_PRESSURE: "Simular pressão",
  PEN_SETTINGS_SIMULATE_PRESSURE_DESC:
    "Se deve simular pressão com base na velocidade.",
  PEN_SETTINGS_SIMULATE_PRESSURE_ALWAYS: "Sempre",
  PEN_SETTINGS_SIMULATE_PRESSURE_NEVER: "Nunca",
  PEN_SETTINGS_SIMULATE_PRESSURE_MOUSE: "Sim para mouse, não para caneta",
  PEN_SETTINGS_START_HEADING: "Início",
  PEN_SETTINGS_START_DESC: "Opções de afunilamento para o início da linha.",
  PEN_SETTINGS_CAP_START: "Extremidade inicial",
  PEN_SETTINGS_CAP_DESC: "Se deve desenhar uma extremidade (cap)",
  PEN_SETTINGS_TAPER: "Afunilamento:",
  PEN_SETTINGS_TAPER_DESC:
    "A distância a afunilar. Se definido como true, o afunilamento será o comprimento total do traço.",
  PEN_SETTINGS_END_HEADING: "Fim",
  PEN_SETTINGS_END_DESC: "Opções de afunilamento para o fim da linha.",
  PEN_SETTINGS_CAP_END: "Extremidade final",
  PEN_SETTINGS_SAVE: "Salvar alterações",
  PEN_SETTINGS_CANCEL: "Cancelar",
  ERROR_ADDING_OBSERVER_MANAGER: "Erro ao adicionar ObserverManager",
  POODF_TITLE: "Arquivos SVG desatualizados",
  POODF_CHECK_RECURSIVE: "Verificar recursivamente",
  POODF_OPEN_SELECTED: "Abrir selecionados",
  IMAGE_CACHE_INITIALIZED:
    "O cache de imagens do Excalidraw está inicializado - você pode tentar abrir novamente seu desenho danificado.",
  NEW_DRAWING_TIMEOUT:
    "Arquivo não encontrado. O novo desenho do Excalidraw está demorando demais para ser criado. Tente novamente.",
};
