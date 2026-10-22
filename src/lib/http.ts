export type HttpErrorDetails = unknown;

export class HttpError extends Error {
  readonly status: number;
  readonly error: string;
  readonly details: HttpErrorDetails;

  constructor(status: number, error: string, details?: HttpErrorDetails) {
    super(error);
    this.name = "HttpError";
    this.status = status;
    this.error = error;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

function mensagemDoErro(body: unknown, status: number): { error: string; details: unknown } {
  if (body && typeof body === "object") {
    const registro = body as Record<string, unknown>;
    const mensagem = registro.error ?? registro.erro ?? registro.message;
    if (typeof mensagem === "string" && mensagem.trim()) {
      return { error: mensagem, details: registro.details ?? registro.detalhes };
    }
  }
  return { error: `Erro na requisicao (HTTP ${status}).`, details: undefined };
}

function guardarMensagemSessao(error: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem("escala_http_erro", error);
  } catch {}
}

function redirecionarLogin(error: string): void {
  if (typeof window === "undefined") return;
  guardarMensagemSessao(error);
  if (window.location.pathname !== "/login") window.location.assign("/login");
}

async function lerResposta(response: Response): Promise<unknown> {
  const texto = await response.text();
  if (!texto) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

async function requisitar<T>(input: RequestInfo | URL, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const init: RequestInit = { ...rest, headers: { ...(headers ?? {}) } };
  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }

  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new HttpError(0, "Nao foi possivel conectar ao servidor. Verifique sua rede e tente novamente.");
  }

  const data = await lerResposta(response);
  if (!response.ok) {
    const normalizado = mensagemDoErro(data, response.status);
    if (response.status === 401) redirecionarLogin(normalizado.error);
    throw new HttpError(response.status, normalizado.error, normalizado.details);
  }
  return data as T;
}

export function httpJson<T>(input: RequestInfo | URL, options: RequestOptions = {}): Promise<T> {
  return requisitar<T>(input, options);
}

export function httpFormData<T>(input: RequestInfo | URL, formData: FormData, options: Omit<RequestInit, "body"> = {}): Promise<T> {
  return requisitar<T>(input, { ...options, body: formData });
}

export function mensagemHttp(error: unknown, fallback = "Nao foi possivel concluir a operacao."): string {
  return error instanceof HttpError ? error.error : error instanceof Error ? error.message : fallback;
}
