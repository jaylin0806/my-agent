# 兒科專科醫師筆試題庫

目前收錄臺灣兒科醫學會 110–114 年度兒科專科醫師筆試甄審試題（A 卷）共 500 題，附官方公告答案，並依次專科分成 15 個主題。題目由醫學會公告的 Word 檔轉出，答案與選項文字皆已逐題和原檔比對。已有詳解（AI 草擬、標示為待審閱）：110–114 年全部 500 題。其中 110、111 年詳解依據《Nelson Textbook of Pediatrics》第 22 版撰寫，參考來源註明章節與頁碼；Nelson 未涵蓋的台灣法規與指引題另註明出處。

這是一個免伺服器、免資料庫的線上題庫。題目存成 JSON，網頁用純 HTML／CSS／JavaScript 寫成，可以免費放上 GitHub Pages，也能用 iframe 嵌進 WordPress 或其他網站。

功能：
- 分年、分主題、隨機出題三種檢視
- 依年度、主題、作答狀態篩選，可搜尋題幹與選項
- 點選選項立即判斷對錯，支援「一題多個答案都給分」和「送分題」
- 兩段式詳解：一句話快速解答＋背景知識、逐選項解析、參考來源
- 作答進度、答對率、錯題本自動存在瀏覽器（localStorage），可單題重做或全部重置
- 可以有多個題庫（例如各科分開），網址加 `?bank=代號` 直接開指定題庫
- 支援手機版面與深色模式

## 資料夾結構

```
docs/                 ← 網站本體（GitHub Pages 從這裡發布）
  index.html
  style.css
  app.js
  data/
    banks.json        ← 題庫清單
    peds.json         ← 兒科專科筆試 110–114 年（500 題）
    sample.json       ← 格式範例（含詳解寫法，未列在 banks.json）
  img/                ← 題目附圖
tools/
  csv2json.py         ← Excel/CSV 轉題庫 JSON
  template.csv        ← CSV 範本
  validate.py         ← 檢查題庫格式
  merge_explanations.py ← 把詳解檔合併進題庫
  explanations/       ← 詳解原稿（每個主題一個檔案，方便審閱修改）
```

## 在自己電腦預覽

瀏覽器不允許直接雙擊打開的 HTML 讀取 JSON 檔，所以要先開一個本機伺服器：

```bash
python3 -m http.server 8000 -d docs
```

然後打開 http://localhost:8000

## 新增題目

### 方法一：用 Excel 整理（推薦）

1. 用 Excel 打開 `tools/template.csv`，照欄位填題目：

   | 欄位 | 說明 |
   |---|---|
   | `id` | 每題唯一的代號，例如 `113-1-25`（年度-梯次-題號）。**作答紀錄靠它對應，發布後不要改** |
   | `year` | 年度，例如 `113` |
   | `exam` | 梯次或考試名稱，例如 `第一次`（可留空） |
   | `no` | 題號 |
   | `topic` | 主題分類 |
   | `stem` | 題幹 |
   | `A`～`E` | 選項，沒有的留空（最多可到 `F`） |
   | `answer` | 正確答案。多個答案都給分就寫 `A,C` |
   | `void` | 送分題填 `是`，否則留空 |
   | `image` | 附圖路徑，例如 `img/113-1-25.jpg`（圖檔放進 `docs/img/`） |
   | `quick` | 一句話快速解答 |
   | `background` | 背景知識（可留空） |
   | `ex_A`～`ex_E` | 每個選項的解析（可留空） |
   | `sources` | 參考來源，多個用 `；` 分隔 |

2. 另存為「**CSV UTF-8（逗號分隔）**」。
3. 轉換並檢查：

   ```bash
   python3 tools/csv2json.py 我的題目.csv --id cardio --name "心臟內科題庫" --year-prefix 民國
   python3 tools/validate.py
   ```

   會產生 `docs/data/cardio.json`，並自動加進 `banks.json`。

### 方法二：直接編輯 JSON

參考 `docs/data/sample.json` 的格式（詳解的完整寫法在這個檔案裡）：

```json
{
  "id": "113-1-25",
  "year": 113,
  "exam": "第一次",
  "no": 25,
  "topic": "心電圖",
  "stem": "題幹，可用 **粗體**，\n換行用 \\n",
  "options": { "A": "…", "B": "…", "C": "…", "D": "…" },
  "answer": "B",
  "image": "img/113-1-25.jpg",
  "explanation": {
    "quick": "一句話快速解答",
    "background": "背景知識",
    "options": { "A": "為何錯", "B": "為何對" },
    "sources": ["教科書章節", "指引名稱"]
  }
}
```

- `answer` 可以是 `"B"`，或 `["A", "C"]`（任一個都算對）
- 送分題加上 `"void": true`
- 沒有 `explanation` 的題目會顯示「詳解撰寫中…」

### 撰寫與審閱詳解

詳解原稿放在 `tools/explanations/`，以題目 id 對應。修改後重新合併：

```bash
python3 tools/merge_explanations.py docs/data/peds.json tools/explanations/peds-cardio.json --draft
```

`--draft` 會在網頁上顯示「AI 草擬、尚待審閱」提示；審閱完成後拿掉 `--draft` 再合併一次即可移除。

改完一定要跑一次 `python3 tools/validate.py`，它會指出缺欄位、答案不在選項中、id 重複、找不到圖片等問題。

## 發布到 GitHub Pages

1. 把變更合併到 `main` 分支。
2. 到 GitHub 倉庫的 **Settings → Pages**。
3. Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾選 `/docs`，按 Save。
4. 約一分鐘後網站會出現在 `https://<你的帳號>.github.io/<倉庫名稱>/`。

> 注意：免費帳號的 GitHub Pages 只能從公開倉庫發布，題目內容會是公開的。

## 嵌入 WordPress 或其他網站

在文章裡加一個「自訂 HTML」區塊，貼上（把網址換成你的）：

```html
<iframe id="quizFrame" src="https://<你的帳號>.github.io/<倉庫名稱>/?bank=cardio"
        title="題庫" loading="lazy" style="width:100%;height:1200px;border:0;"></iframe>
<script>
window.addEventListener('message', function (e) {
  if (e.origin !== 'https://<你的帳號>.github.io') return; // 只接受自己題庫的訊息
  if (e.data && e.data.type === 'quiz-height') {
    document.getElementById('quizFrame').style.height = (e.data.height + 24) + 'px';
  }
});
</script>
```

題庫頁會自動把自己的高度回報給外層頁面，iframe 就會跟著內容長高，不會出現兩層捲軸。

## 已知限制

- 作答紀錄只存在當下這台裝置的瀏覽器，換裝置或清除瀏覽資料就會消失。
- 題目放在 iframe 裡，搜尋引擎通常不會把題目算成外層網站的內容。
