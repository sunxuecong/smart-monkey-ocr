/*
 * @Author: sunxuecong 1668840900@qq.com
 * @Date: 2026-04-02 01:01:12
 * @LastEditors: sunxuecong 1668840900@qq.com
 * @LastEditTime: 2026-04-11 00:01:45
 * @FilePath: /smart-monkey-ocr/src/app/routes/home.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { useRef, useState } from "react";
import env from "@/config/env";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export function ImagePickerPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setOcrResult(null);
    setError(null);
    setIsLoading(true);

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch(env.GLM_OCR_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GLM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "glm-ocr",
          file: base64,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setOcrResult(data.md_results || JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR 调用失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div>
      <h1>图片选择器</h1>
      <input
        accept="image/*"
        onChange={handleFileChange}
        ref={inputRef}
        style={{ display: "none" }}
        type="file"
      />
      <button onClick={handleClick} type="button">
        选择图片
      </button>
      {imageUrl && (
        <div>
          <img alt="Selected" height={500} src={imageUrl} width={500} />
        </div>
      )}
      {isLoading && <p>正在识别...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {ocrResult && (
        <div>
          <h2>OCR 结果：</h2>
          <pre>{ocrResult}</pre>
        </div>
      )}
    </div>
  );
}

// Necessary for react router to lazy load.
export const Component = ImagePickerPage;
