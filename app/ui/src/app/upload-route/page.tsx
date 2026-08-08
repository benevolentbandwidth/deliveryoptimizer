"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HiFiUploadPage from "@/app/components/HiFiUploadPage";
import { createUploadOperation } from "@/app/utils/uploadOperation";
import {
  clearRouteUploadError,
  readRouteUploadError,
  storeUploadedRoute,
} from "@/lib/driver-route/uploadHandoff";

import { parseRouteUploadFile } from "./routeUploadValidation";

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export default function UploadRoutePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const [activeOperation] = useState(createUploadOperation);

  useEffect(() => {
    return () => {
      activeOperation.invalidate();
    };
  }, [activeOperation]);

  useEffect(() => {
    const uploadError = readRouteUploadError() || searchParams.get("error");
    if (!uploadError) return;

    clearRouteUploadError();
    setError(uploadError);
  }, [searchParams]);

  const handleFile = (f: File) => {
    setError(null);
    const fileName = f.name.toLowerCase();
    if (!fileName.endsWith(".json") && !fileName.endsWith(".csv")) {
      setError("Only .json or .csv route files are accepted.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(`File exceeds the ${MAX_FILE_MB} MB limit.`);
      return;
    }
    setFile(f);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleContinue = useCallback(async () => {
    if (!file || isProcessing) return;
    const operation = activeOperation.start();
    const isCurrentOperation = () => activeOperation.isCurrent(operation);

    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();
      if (!isCurrentOperation()) return;
      const uploadedRoute = parseRouteUploadFile(file.name, text);
      storeUploadedRoute(uploadedRoute);
      if (!isCurrentOperation()) return;
      router.push("/driver_assist");
    } catch (err) {
      if (isCurrentOperation()) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        );
      }
    } finally {
      if (isCurrentOperation()) {
        setIsProcessing(false);
      }
    }
  }, [activeOperation, file, isProcessing, router]);

  const handleCancel = () => {
    activeOperation.invalidate();
    setIsProcessing(false);
    router.back();
  };

  return (
    <HiFiUploadPage
      title="Upload your route"
      dropzoneText="Drag and drop JSON or CSV files here, or"
      description={`Import delivery details from a JSON or CSV file. Maximum file size of ${MAX_FILE_MB} MB.`}
      accept=".json,.csv"
      file={file}
      isDragging={isDragging}
      isProcessing={isProcessing}
      error={error}
      onSelectFile={handleFile}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onRemoveFile={() => {
        setFile(null);
        setError(null);
      }}
      onCancel={handleCancel}
      onNext={() => void handleContinue()}
    />
  );
}
