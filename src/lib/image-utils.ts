import imageCompression from 'browser-image-compression';

export async function compressAvatarImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.5, // 500KB
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/jpeg' as string,
    initialQuality: 0.85,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}
