import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Log from "./Log";
import "./RecordingsPage.css";

const API_BASE = "http://127.0.0.1:5000";

const normalizeDate = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function RecordingsPage() {
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => normalizeDate(new Date()));
  const [calendarViewDate, setCalendarViewDate] = useState(() => normalizeDate(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMode, setViewMode] = useState("daily"); // 'daily' or 'all'
  const calendarRef = useRef(null);
  const navigate = useNavigate();

  const groupLogsByDate = (items) => {
    const grouped = {};
    items.forEach((log) => {
      try {
        const date = new Date(log.date);
        if (Number.isNaN(date.getTime())) {
          throw new Error("Invalid date");
        }

        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(date.getDate()).padStart(2, "0")}`;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(log);
      } catch {
        if (!grouped.unknown) grouped.unknown = [];
        grouped.unknown.push(log);
      }
    });

    Object.values(grouped).forEach((dateLogs) => {
      dateLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    return grouped;
  };

  // Function to fetch all logs.
  const fetchAllLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/get-logs`);
      const data = await response.json();

      if (data.logs) {
        // Store the total recordings count in localStorage.
        localStorage.setItem("recordingsCount", data.logs.length.toString());
        setAllLogs(data.logs || []);
        return data.logs;
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch all logs:", error);
      setAllLogs([]);
      return [];
    }
  };

  // Filter logs for the selected date.
  const filterLogsForSelectedDate = (items, date) => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return items.filter((log) => {
      try {
        const logDate = new Date(log.date);
        if (Number.isNaN(logDate.getTime())) {
          return false;
        }
        return logDate >= targetDate && logDate < nextDay;
      } catch {
        return false;
      }
    });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Always fetch all logs to have them ready and for the count.
        const allLogsData = await fetchAllLogs();

        // If we're in daily view, filter logs for the selected date.
        if (viewMode === "daily") {
          const dailyLogs = filterLogsForSelectedDate(allLogsData, selectedDate);
          setLogs(dailyLogs);
        } else {
          // In "all" view, use all the logs.
          setLogs(allLogsData);
        }
      } catch (error) {
        console.error("Database connection failed:", error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedDate, viewMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Calendar helper functions
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  // Generate calendar days for current month view
  const generateCalendarDays = () => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);

    const days = [];

    // Add empty slots for days before the first of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ day: "", isCurrentMonth: false });
    }

    // Add days of the current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      const hasRecordings = allLogs.some((log) => {
        const logDate = new Date(log.date);
        if (Number.isNaN(logDate.getTime())) {
          return false;
        }

        return (
          logDate.getFullYear() === year &&
          logDate.getMonth() === month &&
          logDate.getDate() === i
        );
      });

      days.push({
        day: i,
        isCurrentMonth: true,
        isToday: isSameDay(normalizeDate(new Date()), dayDate),
        isSelected: isSameDay(selectedDate, dayDate),
        hasRecordings,
      });
    }

    return days;
  };

  const groupedLogs = useMemo(() => groupLogsByDate(logs), [logs]);

  const sortedGroupedEntries = useMemo(() => {
    return Object.entries(groupedLogs).sort(([dateA], [dateB]) => {
      if (dateA === "unknown") return 1;
      if (dateB === "unknown") return -1;
      return dateA < dateB ? 1 : -1;
    });
  }, [groupedLogs]);

  const toggleCalendar = () => {
    if (!calendarOpen) {
      setCalendarViewDate(new Date(selectedDate));
    }
    setCalendarOpen((prev) => !prev);
  };

  const moveCalendarMonth = (increment) => {
    setCalendarViewDate((prev) => {
      const next = new Date(prev);
      next.setDate(1);
      next.setMonth(next.getMonth() + increment);
      return next;
    });
  };

  const selectDay = (day) => {
    if (!day.isCurrentMonth) {
      return;
    }

    const pickedDate = normalizeDate(
      new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), day.day)
    );
    setSelectedDate(pickedDate);
    setCalendarViewDate(pickedDate);
    setCalendarOpen(false);
  };

  const goToPreviousDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return normalizeDate(next);
    });
  };

  const goToNextDay = () => {
    const today = normalizeDate(new Date());
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      const normalizedNext = normalizeDate(next);
      return normalizedNext <= today ? normalizedNext : prev;
    });
  };

  const selectedDateIsToday = isSameDay(selectedDate, normalizeDate(new Date()));

  return (
    <div className="recordings-container">
      <div className="recordings-header">
        <h1>Recordings Archive</h1>
        <p className="recordings-subtitle">
          {viewMode === "daily"
            ? "Viewing recordings from selected date"
            : "Browsing all detected motion events"}
        </p>
      </div>

      <div className="recordings-controls">
        <div className="calendar-picker" ref={calendarRef}>
          <div className="date-display" onClick={toggleCalendar}>
            <span className="calendar-icon" aria-hidden="true"></span>
            <span className="selected-date">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="dropdown-icon">{calendarOpen ? "▲" : "▼"}</span>
          </div>

          {calendarOpen && (
            <div className="calendar-dropdown">
              <div className="calendar-header">
                <button
                  className="month-nav"
                  onClick={() => moveCalendarMonth(-1)}
                >
                  &laquo;
                </button>
                <h3>
                  {calendarViewDate.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <button
                  className="month-nav"
                  onClick={() => moveCalendarMonth(1)}
                >
                  &raquo;
                </button>
              </div>

              <div className="calendar-days-header">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="day-name">
                    {day}
                  </div>
                ))}
              </div>

              <div className="calendar-days">
                {generateCalendarDays().map((day, index) => (
                  <div
                    key={`${day.day}-${index}`}
                    className={`calendar-day ${!day.isCurrentMonth ? "outside-month" : ""} ${
                      day.isToday ? "today" : ""
                    } ${day.isSelected ? "selected" : ""} ${
                      day.hasRecordings ? "has-recordings" : ""
                    }`}
                    onClick={() => selectDay(day)}
                  >
                    {day.day}
                    {day.hasRecordings && <span className="recording-dot"></span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn ${viewMode === "daily" ? "active" : ""}`}
            onClick={() => setViewMode("daily")}
          >
            Daily View
          </button>
          <button
            className={`view-mode-btn ${viewMode === "all" ? "active" : ""}`}
            onClick={() => setViewMode("all")}
          >
            All Recordings
          </button>
        </div>

        {viewMode === "daily" && (
          <div className="date-navigation">
            <button className="date-nav-btn" onClick={goToPreviousDay}>Previous Day</button>
            <div className="current-date">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <button className="date-nav-btn" onClick={goToNextDay} disabled={selectedDateIsToday}>
              Next Day
            </button>
          </div>
        )}
      </div>

      <div className="recordings-summary">
        <span className="recording-count">
          {viewMode === "daily"
            ? `${logs.length} recording${logs.length !== 1 ? "s" : ""} on ${selectedDate.toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }
              )}`
            : `Showing ${logs.length} total recording${logs.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loader-spinner"></div>
          <p>Loading recordings...</p>
        </div>
      ) : (
        <>
          {Object.keys(groupedLogs).length === 0 ? (
            <div className="no-recordings">
              <div className="empty-icon" aria-hidden="true"></div>
              <h3>No recordings found</h3>
              <p>
                {viewMode === "daily"
                  ? `No recordings found for ${selectedDate.toLocaleDateString()}` 
                  : "No recordings available"}
              </p>
            </div>
          ) : (
            <div className="recordings-timeline">
              {sortedGroupedEntries.map(([date, dateLogs]) => (
                <div key={date} className="timeline-date">
                  <div className="date-marker">
                    <div className="date-badge">
                      {date === "unknown"
                        ? "Unknown Date"
                        : new Date(date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                    </div>
                  </div>
                  <div className="recordings-grid">
                    {dateLogs.map((log, i) => (
                      <Log
                        key={`${log.url}-${i}`}
                        url={`${API_BASE}${log.url}`}
                        date={log.date}
                        onClick={(url, dateValue) =>
                          navigate("/details", { state: { url, date: dateValue } })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}