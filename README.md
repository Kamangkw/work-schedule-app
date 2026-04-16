# 工作排班系統

一個簡單嘅澳門工作排班記錄 app。

## 功能

- 月曆顯示返工 / 放假
- 澳門公眾假期自動標記
- 手動標記放假日子
- 月度統計

## 部署到 Render

1. Fork 呢個 repo 到你 GitHub
2. 去 [render.com](https://render.com) 用 GitHub 登入
3. New → Static Site → 揀呢個 repo
4. 設定：
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn main:app --bind 0.0.0.0:$PORT`
5. 點 Create

## 本地運行

```bash
pip install -r requirements.txt
python main.py
```

打開瀏覽器：http://localhost:5000
