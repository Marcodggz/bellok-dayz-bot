export interface NitradoFileEntry {
  type: string;
  name: string;
  path?: string;
}

export interface NitradoFileListData {
  entries?: NitradoFileEntry[];
}

export interface NitradoFileListResponse {
  data?: {
    data?: NitradoFileListData;
  };
}

export interface AdmFile {
  name: string;
  path: string;
}

export interface NitradoDownloadSuccess {
  buffer: Buffer;
  error?: never;
}

export interface NitradoDownloadError {
  error: true;
  buffer?: never;
}

export type NitradoDownloadResult = NitradoDownloadSuccess | NitradoDownloadError;

export interface NitradoDownloadToken {
  url?: string;
}

export interface NitradoDownloadTokenResponse {
  data?: {
    token?: NitradoDownloadToken;
  };
  token?: NitradoDownloadToken;
}
