import fs from "node:fs";
import { Readable } from "node:stream";
import { google } from "googleapis";

export function buildDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export async function downloadDriveFile(fileId) {
  const response = await fetch(buildDownloadUrl(fileId));
  if (!response.ok) {
    throw new Error(`No se pudo descargar Drive file ${fileId}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  return undefined;
}

export async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/drive.file"]
  });
  return google.drive({ version: "v3", auth });
}

export async function uploadFileToDrive({ filePath, fileName, mimeType, folderId }) {
  const drive = await getDriveClient();
  const result = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath)
    },
    fields: "id,name,webViewLink,createdTime,modifiedTime"
  });
  return result.data;
}

export async function uploadTextToDrive({ text, fileName, mimeType = "application/json", folderId }) {
  const drive = await getDriveClient();
  const result = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined
    },
    media: {
      mimeType,
      body: Readable.from([text])
    },
    fields: "id,name,webViewLink,createdTime,modifiedTime"
  });
  return result.data;
}

export async function listDriveFiles({ folderId, namePrefix }) {
  const drive = await getDriveClient();
  const queryParts = ["trashed = false"];
  if (folderId) queryParts.push(`'${folderId}' in parents`);
  if (namePrefix) queryParts.push(`name contains '${namePrefix.replace(/'/g, "\\'")}'`);
  const result = await drive.files.list({
    q: queryParts.join(" and "),
    fields: "files(id,name,webViewLink,createdTime,modifiedTime)",
    orderBy: "name desc",
    pageSize: 100
  });
  return result.data.files || [];
}

export async function downloadDriveText(fileId) {
  const drive = await getDriveClient();
  const result = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
  return typeof result.data === "string" ? result.data : JSON.stringify(result.data);
}
