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
    reason = db.Column(db.String(100), nullable=True)
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
    user_off_dates = {d.date for d in user_days_off}

    import calendar
    cal = calendar.Calendar(firstweekday=6)
    days = []

    for day in cal.itermonthdays(year, month):
        if day == 0:
            days.append({"day": None})
            continue

        d = date(year, month, day)
        is_holiday = d in MACAU_HOLIDAYS
        is_user_off = d in user_off_dates
        is_weekend = d.weekday() >= 5

        if is_holiday:
            status = "holiday"
            label = MACAU_HOLIDAYS[d]
        elif is_user_off:
            status = "user_off"
            label = "放假"
        elif is_weekend:
            status = "weekend"
            label = "週末"
        else:
            status = "work"
            label = "返工"

        days.append({
            "day": day,
            "date": d.isoformat(),
            "status": status,
            "label": label,
            "is_holiday": is_holiday,
            "is_weekend": is_weekend,
        })

    return jsonify({
        "year": year,
        "month": month,
        "days": days,
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
    if not date_str:
        return jsonify({"error": "請選擇日期"}), 400

    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    holiday_name = MACAU_HOLIDAYS.get(d)

    existing = DayOff.query.filter_by(user_id=user_id, date=d).first()
    if existing:
        return jsonify({"error": "該日期已設置"}), 400

    day_off = DayOff(
        user_id=user_id,
        date=d,
        reason="user",
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
    holiday_days = 0
    user_off_days = 0
    weekend_days = 0

    user_days_off = DayOff.query.filter(
        DayOff.user_id == user_id,
        DayOff.date >= start_date,
        DayOff.date <= end_date
    ).all()
    user_off_dates = {d.date for d in user_days_off}

    d = start_date
    while d <= end_date:
        is_holiday = d in MACAU_HOLIDAYS
        is_user_off = d in user_off_dates
        is_weekend = d.weekday() >= 5

        if is_holiday:
            holiday_days += 1
        elif is_user_off:
            user_off_days += 1
        elif is_weekend:
            weekend_days += 1
        else:
            work_days += 1

        d += timedelta(days=1)

    return jsonify({
        "year": year,
        "month": month,
        "work_days": work_days,
        "holiday_days": holiday_days,
        "user_off_days": user_off_days,
        "weekend_days": weekend_days,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
