import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Log from "./Log";
import "./RecordingsPage.css";
import { API_BASE } from "./config";


const normalizeDate = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Recordings from the given day, by local time.
const filterLogsForSelectedDate = (items, date) => {
  const targetDate = normalizeDate(date);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  return items.filter((log) => {
    const logDate = new Date(log.date);
    if (Number.isNaN(logDate.getTime())) {
      return false;
    }
    return logDate >= targetDate && logDate < nextDay;
  });
};

export default function RecordingsPage() {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
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

  // Fetch the full list once (and again on retry). Date and view changes are
  // filtered locally from allLogs, so they don't refetch.
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/get-logs`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;
        setAllLogs(data.logs || []);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load recordings:", error);
        setAllLogs([]);
        setLoadError("Couldn't load recordings. Check that the LensFort backend is running.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const logs = useMemo(
    () => (viewMode === "daily" ? filterLogsForSelectedDate(allLogs, selectedDate) : allLogs),
    [allLogs, selectedDate, viewMode]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setCalendarOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
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
          <button
            type="button"
            className="date-display"
            onClick={toggleCalendar}
            aria-haspopup="dialog"
            aria-expanded={calendarOpen}
          >
            <span className="calendar-icon" aria-hidden="true"></span>
            <span className="selected-date">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="dropdown-icon" aria-hidden="true">{calendarOpen ? "▲" : "▼"}</span>
          </button>

          {calendarOpen && (
            <div className="calendar-dropdown" role="dialog" aria-label="Choose a date">
              <div className="calendar-header">
                <button
                  type="button"
                  className="month-nav"
                  onClick={() => moveCalendarMonth(-1)}
                  aria-label="Previous month"
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
                  type="button"
                  className="month-nav"
                  onClick={() => moveCalendarMonth(1)}
                  aria-label="Next month"
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
                {generateCalendarDays().map((day, index) => {
                  const className = `calendar-day ${!day.isCurrentMonth ? "outside-month" : ""} ${
                    day.isToday ? "today" : ""
                  } ${day.isSelected ? "selected" : ""} ${
                    day.hasRecordings ? "has-recordings" : ""
                  }`;

                  // Padding cells before the 1st aren't selectable.
                  if (!day.isCurrentMonth) {
                    return <div key={`empty-${index}`} className={className} />;
                  }

                  const dayDate = new Date(
                    calendarViewDate.getFullYear(),
                    calendarViewDate.getMonth(),
                    day.day
                  );

                  return (
                    <button
                      type="button"
                      key={`${day.day}-${index}`}
                      className={className}
                      onClick={() => selectDay(day)}
                      aria-pressed={day.isSelected}
                      aria-label={`${dayDate.toDateString()}${
                        day.hasRecordings ? ", has recordings" : ""
                      }`}
                    >
                      {day.day}
                      {day.hasRecordings && (
                        <span className="recording-dot" aria-hidden="true"></span>
                      )}
                    </button>
                  );
                })}
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
      ) : loadError ? (
        <div className="no-recordings load-error" role="alert">
          <h3>Recordings unavailable</h3>
          <p>{loadError}</p>
          <button
            type="button"
            className="retry-btn"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Retry
          </button>
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