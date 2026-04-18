"""
Work Schedule App - 澳門工作排班系統
"""

import os
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date, timezone, timedelta
from functools import wraps

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "work-schedule-secret-2026")
app.config["SESSION_TYPE"] = "filesystem"
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///schedule.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ===== 澳門 2026-2028 公眾假期 =====

MACAU_HOLIDAYS = {
    # 2026
    date(2026, 1, 1): "元旦",
    date(2026, 1, 28): "春節前夕",
    date(2026, 1, 29): "春節（初一）",
    date(2026, 1, 30): "春節（初二）",
    date(2026, 1, 31): "春節（初三）",
    date(2026, 2, 1): "春節（初四）",
    date(2026, 2, 2): "春節（初五）",
    date(2026, 2, 3): "春節（初六）",
    date(2026, 2, 14): "情人節",
    date(2026, 3, 8): "婦女節",
    date(2026, 3, 20): "行政人員準職假",
    date(2026, 3, 22): "清明節",
    date(2026, 4, 3): "耶穌受難日",
    date(2026, 4, 4): "清明節翌日",
    date(2026, 4, 5): "復活節前日",
    date(2026, 5, 1): "勞動節",
    date(2026, 5, 3): "佛誕節",
    date(2026, 5, 10): "母親節翌日",
    date(2026, 6, 1): "兒童節",
    date(2026, 6, 18): "端午節",
    date(2026, 6, 19): "端午節翌日",
    date(2026, 7, 1): "特區成立紀念日",
    date(2026, 9, 13): "中秋節翌日",
    date(2026, 10, 1): "國慶日",
    date(2026, 10, 2): "國慶日翌日",
    date(2026, 10, 17): "重陽節",
    date(2026, 11, 2): "追思節",
    date(2026, 12, 1): "行政人員準職假",
    date(2026, 12, 8): "聖母無原罪瞻禮",
    date(2026, 12, 20): "澳門特別行政區成立紀念日",
    date(2026, 12, 21): "冬至",
    date(2026, 12, 24): "平安夜",
    date(2026, 12, 25): "聖誕節",
    date(2026, 12, 26): "聖誕節前日",
    date(2026, 12, 31): "除夕",
    # 2027
    date(2027, 1, 1): "元旦",
    date(2027, 2, 16): "春節前夕",
    date(2027, 2, 17): "春節（初一）",
    date(2027, 2, 18): "春節（初二）",
    date(2027, 2, 19): "春節（初三）",
    date(2027, 2, 20): "春節（初四）",
    date(2027, 2, 21): "春節（初五）",
    date(2027, 2, 22): "春節（初六）",
    date(2027, 3, 8): "婦女節",
    date(2027, 3, 20): "行政人員準職假",
    date(2027, 4, 5): "清明節",
    date(2027, 4, 6): "耶穌受難日",
    date(2027, 4, 7): "清明節翌日",
    date(2027, 5, 1): "勞動節",
    date(2027, 5, 9): "佛誕節",
    date(2027, 5, 13): "母親節翌日",
    date(2027, 6, 1): "兒童節",
    date(2027, 6, 26): "端午節",
    date(2027, 7, 1): "特區成立紀念日",
    date(2027, 9, 22): "中秋節翌日",
    date(2027, 10, 1): "國慶日",
    date(2027, 10, 2): "國慶日翌日",
    date(2027, 10, 17): "重陽節",
    date(2027, 11, 2): "追思節",
    date(2027, 12, 1): "行政人員準職假",
    date(2027, 12, 8): "聖母無原罪瞻禮",
    date(2027, 12, 20): "澳門特別行政區成立紀念日",
    date(2027, 12, 21): "冬至",
    date(2027, 12, 24): "平安夜",
    date(2027, 12, 25): "聖誕節",
    date(2027, 12, 26): "聖誕節前日",
    date(2027, 12, 31): "除夕",
    # 2028
    date(2028, 1, 1): "元旦",
    date(2028, 2, 4): "春節前夕",
    date(2028, 2, 5): "春節（初一）",
    date(2028, 2, 6): "春節（初二）",
    date(2028, 2, 7): "春節（初三）",
    date(2028, 2, 8): "春節（初四）",
    date(2028, 2, 9): "春節（初五）",
    date(2028, 2, 10): "春節（初六）",
    date(2028, 3, 8): "婦女節",
    date(2028, 3, 20): "行政人員準職假",
    date(2028, 4, 4): "清明節",
    date(2028, 4, 14): "耶穌受難日",
    date(2028, 4, 15): "清明節翌日",
    date(2028, 4, 16): "復活節前日",
    date(2028, 5, 1): "勞動節",
    date(2028, 5, 13): "佛誕節",
    date(2028, 5, 14): "母親節翌日",
    date(2028, 6, 1): "兒童節",
    date(2028, 6, 6): "端午節",
    date(2028, 7, 1): "特區成立紀念日",
    date(2028, 9, 11): "中秋節翌日",
    date(2028, 10, 1): "國慶日",
    date(2028, 10, 2): "國慶日翌日",
    date(2028, 10, 23): "重陽節",
    date(2028, 11, 2): "追思節",
    date(2028, 12, 1): "行政人員準職假",
    date(2028, 12, 8): "聖母無原罪瞻禮",
    date(2028, 12, 20): "澳門特別行政區成立紀念日",
    date(2028, 12, 21): "冬至",
    date(2028, 12, 24): "平安夜",
    date(2028, 12, 25): "聖誕節",
    date(2028, 12, 26): "聖誕節前日",
    date(2028, 12, 31): "除夕",
}

# ===== 假期類型 =====
LEAVE_TYPES = {
    "off": "放假",
    "leave_annual": "年假",
    "leave_compensatory": "補假",
}


# ===== Models =====

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    days_off = db.relationship("DayOff", backref="user", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DayOff(db.Model):
    __tablename__ = "days_off"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(100), nullable=True)  # off, leave_annual, leave_compensatory
    holiday_name = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("user_id", "date", name="uix_user_date"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat(),
            "reason": self.reason,
            "leave_label": LEAVE_TYPES.get(self.reason, self.reason),
            "holiday_name": self.holiday_name,
        }


# ===== Routes =====

@app.before_request
def ensure_db():
    db.create_all()


def get_user_id():
    return session.get("user_id")


@app.route("/")
def index():
    user_name = session.get("user_name")
    return render_template("index.html", user_name=user_name)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "請輸入姓名"}), 400

    user = User.query.filter_by(name=name).first()
    if not user:
        user = User(name=name)
        db.session.add(user)
        db.session.commit()

    session["user_id"] = user.id
    session["user_name"] = user.name
    return jsonify(user.to_dict())


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "已登出"})


@app.route("/api/current-user")
def get_current_user():
    user_name = session.get("user_name")
    user_id = session.get("user_id")
    if user_name:
        return jsonify({"id": user_id, "name": user_name})
    return jsonify(None)


@app.route("/api/calendar/<int:year>/<int:month>")
def get_calendar(year, month):
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401

    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    user_days_off = DayOff.query.filter(
        DayOff.user_id == user_id,
        DayOff.date >= start_date,
        DayOff.date <= end_date
    ).all()
    off_dates_map = {d.date: d for d in user_days_off}

    # 計算統計
    work_days = 0
    off_days = 0
    d = start_date
    while d <= end_date:
        if d in off_dates_map:
            off_days += 1
        else:
            work_days += 1
        d += timedelta(days=1)

    import calendar
    cal = calendar.Calendar(firstweekday=6)
    days = []

    for day in cal.itermonthdays(year, month):
        if day == 0:
            days.append({"day": None})
            continue

        d = date(year, month, day)
        day_off = off_dates_map.get(d)

        if day_off:
            status = day_off.reason or "off"
            label = LEAVE_TYPES.get(status, status)
        else:
            status = "empty"
            label = ""

        days.append({
            "day": day,
            "date": d.isoformat(),
            "status": status,
            "label": label,
        })

    return jsonify({
        "year": year,
        "month": month,
        "days": days,
        "work_days": work_days,
        "off_days": off_days,
    })


@app.route("/api/days-off", methods=["GET"])
def get_days_off():
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401

    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)

    query = DayOff.query.filter_by(user_id=user_id)

    if year and month:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        query = query.filter(DayOff.date >= start_date, DayOff.date <= end_date)

    days = query.order_by(DayOff.date.desc()).all()
    return jsonify([d.to_dict() for d in days])


@app.route("/api/days-off", methods=["POST"])
def add_day_off():
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401

    data = request.get_json()
    date_str = data.get("date")
    leave_type = data.get("leave_type", "off")
    if not date_str:
        return jsonify({"error": "請選擇日期"}), 400

    if leave_type not in LEAVE_TYPES:
        return jsonify({"error": "無效的假期類型"}), 400

    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    holiday_name = MACAU_HOLIDAYS.get(d)

    existing = DayOff.query.filter_by(user_id=user_id, date=d).first()
    if existing:
        return jsonify({"error": "該日期已設置"}), 400

    day_off = DayOff(
        user_id=user_id,
        date=d,
        reason=leave_type,
        holiday_name=holiday_name
    )
    db.session.add(day_off)
    db.session.commit()
    return jsonify(day_off.to_dict()), 201


@app.route("/api/days-off/<date_str>", methods=["DELETE"])
def remove_day_off(date_str):
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401

    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_off = DayOff.query.filter_by(user_id=user_id, date=d).first()
    if not day_off:
        return jsonify({"error": "找不到記錄"}), 404

    db.session.delete(day_off)
    db.session.commit()
    return jsonify({"message": "已刪除"})


@app.route("/api/days-off/batch", methods=["POST"])
def batch_update_days_off():
    """批次更新假期：一次過處理多個新增/刪除"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401

    data = request.get_json()
    changes = data.get("changes", [])

    results = {"added": 0, "removed": 0, "updated": 0, "errors": []}

    for change in changes:
        date_str = change.get("date")
        action = change.get("action")

        try:
            d = datetime.strptime(date_str, "%Y-%m-%d").date()

            if action == "add":
                leave_type = change.get("leave_type", "off")
                existing = DayOff.query.filter_by(user_id=user_id, date=d).first()
                if existing:
                    # 更新類型
                    existing.reason = leave_type
                    results["updated"] += 1
                else:
                    # 新增
                    holiday_name = MACAU_HOLIDAYS.get(d)
                    day_off = DayOff(
                        user_id=user_id,
                        date=d,
                        reason=leave_type,
                        holiday_name=holiday_name
                    )
                    db.session.add(day_off)
                    results["added"] += 1

            elif action == "remove":
                existing = DayOff.query.filter_by(user_id=user_id, date=d).first()
                if existing:
                    db.session.delete(existing)
                    results["removed"] += 1

        except Exception as e:
            results["errors"].append({"date": date_str, "error": str(e)})

    db.session.commit()
    return jsonify(results)


@app.route("/api/days-off/<date_str>", methods=["PATCH"])
def update_day_off(date_str):
    """更新假期類型"""
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401

    data = request.get_json()
    leave_type = data.get("leave_type")
    if not leave_type or leave_type not in LEAVE_TYPES:
        return jsonify({"error": "無效的假期類型"}), 400

    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_off = DayOff.query.filter_by(user_id=user_id, date=d).first()
    if not day_off:
        return jsonify({"error": "找不到記錄"}), 404

    day_off.reason = leave_type
    db.session.commit()
    return jsonify(day_off.to_dict())


@app.route("/api/summary/<int:year>/<int:month>")
def get_summary(year, month):
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401

    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    work_days = 0
    off_days = 0
    leave_annual_days = 0
    leave_compensatory_days = 0

    user_days_off = DayOff.query.filter(
        DayOff.user_id == user_id,
        DayOff.date >= start_date,
        DayOff.date <= end_date
    ).all()
    off_dates = {d.date: d.reason for d in user_days_off}

    d = start_date
    while d <= end_date:
        reason = off_dates.get(d)
        if reason == "leave_annual":
            leave_annual_days += 1
            off_days += 1
        elif reason == "leave_compensatory":
            leave_compensatory_days += 1
            off_days += 1
        elif reason:
            off_days += 1
        else:
            work_days += 1
        d += timedelta(days=1)

    return jsonify({
        "year": year,
        "month": month,
        "work_days": work_days,
        "off_days": off_days,
        "leave_annual_days": leave_annual_days,
        "leave_compensatory_days": leave_compensatory_days,
    })


@app.route("/api/export", methods=["GET"])
def export_days_off():
    """匯出用家所有放假記錄（支援 API Key 認證）"""
    # API Key 認證（用 Header: X-API-Key）
    api_key = os.environ.get("EXPORT_API_KEY")
    debug_info = {
        "env_EXPORT_API_KEY_set": api_key is not None,
        "env_EXPORT_API_KEY_value": api_key if api_key else "NOT_SET",
    }
    
    if api_key:
        provided_key = request.headers.get("X-API-Key")
        debug_info["provided_key"] = provided_key
        debug_info["match"] = provided_key == api_key
        if provided_key != api_key:
            return jsonify({"error": "無效 API Key", "debug": debug_info}), 403
    
    user_id = get_user_id()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401

    days = DayOff.query.filter_by(user_id=user_id).order_by(DayOff.date).all()
    
    # 按年分類
    by_year = {}
    for d in days:
        year = d.date.year
        if year not in by_year:
            by_year[year] = []
        by_year[year].append({
            "date": d.date.isoformat(),
            "reason": d.reason,
            "holiday_name": d.holiday_name,
        })
    
    return jsonify({
        "user_id": user_id,
        "total": len(days),
        "by_year": by_year,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
