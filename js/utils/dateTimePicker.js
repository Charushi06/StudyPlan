/**
 * Custom Date-Time Picker Component
 * A modern, dark-themed inline date & time picker.
 */

import { validateDateTime, formatDateTimeLocal } from './validation.js';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export class DateTimePicker {
  /**
   * @param {HTMLElement} containerEl - The element to mount the picker into.
   * @param {object} [options]
   * @param {function} [options.onChange] - Callback when value changes.
   */
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onChange = options.onChange || null;

    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth();

    this.selectedDay = null;
    this.selectedMonth = null;
    this.selectedYear = null;
    this.selectedHour = now.getHours() % 12 || 12;
    this.selectedMinute = Math.min(59, now.getMinutes() + (now.getMinutes() % 5 === 0 ? 0 : 5 - (now.getMinutes() % 5)));
    if (this.selectedMinute >= 60) { this.selectedMinute = 0; this.selectedHour++; }
    this.selectedPeriod = now.getHours() >= 12 ? 'PM' : 'AM';

    this.render();
  }

  /** Returns the currently selected datetime as a YYYY-MM-DDTHH:mm string, or '' if no date selected. */
  getValue() {
    if (this.selectedDay === null || this.selectedMonth === null || this.selectedYear === null) {
      return '';
    }
    let h = this.selectedHour;
    if (this.selectedPeriod === 'AM' && h === 12) h = 0;
    if (this.selectedPeriod === 'PM' && h !== 12) h += 12;

    const y = this.selectedYear;
    const m = String(this.selectedMonth + 1).padStart(2, '0');
    const d = String(this.selectedDay).padStart(2, '0');
    const hh = String(h).padStart(2, '0');
    const mm = String(this.selectedMinute).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  /** Sets the picker value from a datetime-local string or ISO string. */
  setValue(dateStr) {
    if (!dateStr) {
      this.selectedDay = null;
      this.selectedMonth = null;
      this.selectedYear = null;
      this.render();
      return;
    }
    let d;
    if (dateStr.includes('T')) {
      const [datePart, timePart] = dateStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      d = new Date(year, month - 1, day, hours, minutes);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return;

    this.selectedYear = d.getFullYear();
    this.selectedMonth = d.getMonth();
    this.selectedDay = d.getDate();
    this.viewYear = d.getFullYear();
    this.viewMonth = d.getMonth();

    let hrs = d.getHours();
    this.selectedPeriod = hrs >= 12 ? 'PM' : 'AM';
    this.selectedHour = hrs % 12 || 12;
    this.selectedMinute = d.getMinutes();

    this.render();
  }

  /** Checks if a given day in the current view is in the past. */
  _isDayInPast(day) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const check = new Date(this.viewYear, this.viewMonth, day);
    return check < now;
  }

  /** Checks if a given day is today. */
  _isToday(day) {
    const now = new Date();
    return day === now.getDate() && this.viewMonth === now.getMonth() && this.viewYear === now.getFullYear();
  }

  /** Checks if a given day is the currently selected date. */
  _isSelected(day) {
    return day === this.selectedDay && this.viewMonth === this.selectedMonth && this.viewYear === this.selectedYear;
  }

  _fireChange() {
    if (this.onChange) this.onChange(this.getValue());
    // Also dispatch a native-like event on the container
    this.container.dispatchEvent(new Event('change', { bubbles: true }));
  }

  render() {
    const now = new Date();
    const firstDayOfMonth = new Date(this.viewYear, this.viewMonth, 1).getDay();
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.viewYear, this.viewMonth, 0).getDate();

    // Can we go to prev month? Only if prev month has at least one future/today day
    const canGoPrev = !(this.viewYear < now.getFullYear() || (this.viewYear === now.getFullYear() && this.viewMonth <= now.getMonth()));

    // Build calendar grid
    let calendarDaysHtml = '';

    // Previous month trailing days
    for (let i = 0; i < firstDayOfMonth; i++) {
      const dayNum = prevMonthDays - firstDayOfMonth + i + 1;
      calendarDaysHtml += `<div class="dtp-day dtp-day--muted">${dayNum}</div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isPast = this._isDayInPast(d);
      const isToday = this._isToday(d);
      const isSelected = this._isSelected(d);
      const classes = ['dtp-day'];
      if (isPast) classes.push('dtp-day--disabled');
      if (isToday) classes.push('dtp-day--today');
      if (isSelected) classes.push('dtp-day--selected');
      if (!isPast) classes.push('dtp-day--active');

      calendarDaysHtml += `<div class="${classes.join(' ')}" data-day="${d}">${d}</div>`;
    }

    // Next month leading days
    const totalCells = firstDayOfMonth + daysInMonth;
    const nextDays = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= nextDays; i++) {
      calendarDaysHtml += `<div class="dtp-day dtp-day--muted">${i}</div>`;
    }

    // Build hour options
    let hourOptionsHtml = '';
    for (let h = 1; h <= 12; h++) {
      const sel = h === this.selectedHour ? 'dtp-time-option--selected' : '';
      hourOptionsHtml += `<div class="dtp-time-option ${sel}" data-hour="${h}">${String(h).padStart(2, '0')}</div>`;
    }

    // Build minute options (steps of 5)
    let minuteOptionsHtml = '';
    for (let m = 0; m < 60; m += 5) {
      const sel = m === this.selectedMinute ? 'dtp-time-option--selected' : '';
      minuteOptionsHtml += `<div class="dtp-time-option ${sel}" data-minute="${m}">${String(m).padStart(2, '0')}</div>`;
    }

    // Selected date display
    let selectionDisplay = '';
    if (this.selectedDay !== null) {
      const dateObj = new Date(this.selectedYear, this.selectedMonth, this.selectedDay);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = MONTH_NAMES[this.selectedMonth].slice(0, 3);
      selectionDisplay = `${dayName}, ${monthName} ${this.selectedDay}, ${this.selectedYear} · ${String(this.selectedHour).padStart(2,'0')}:${String(this.selectedMinute).padStart(2,'0')} ${this.selectedPeriod}`;
    } else {
      selectionDisplay = 'Select a date & time';
    }

    this.container.innerHTML = `
      <div class="dtp-container">
        <div class="dtp-selected-display">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M1 6h14" stroke="currentColor" stroke-width="1.5"/><path d="M5 1v2M11 1v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>${selectionDisplay}</span>
        </div>

        <div class="dtp-calendar">
          <div class="dtp-cal-header">
            <button class="dtp-nav-btn dtp-prev-btn" ${!canGoPrev ? 'disabled' : ''} type="button">‹</button>
            <span class="dtp-cal-title">${MONTH_NAMES[this.viewMonth]} ${this.viewYear}</span>
            <button class="dtp-nav-btn dtp-next-btn" type="button">›</button>
          </div>
          <div class="dtp-cal-labels">
            ${DAY_LABELS.map(l => `<div class="dtp-cal-label">${l}</div>`).join('')}
          </div>
          <div class="dtp-cal-grid">
            ${calendarDaysHtml}
          </div>
        </div>

        <div class="dtp-time">
          <div class="dtp-time-label">Time</div>
          <div class="dtp-time-row">
            <div class="dtp-time-col">
              <div class="dtp-time-col-label">Hour</div>
              <div class="dtp-time-scroll" data-type="hour">
                ${hourOptionsHtml}
              </div>
            </div>
            <div class="dtp-time-separator">:</div>
            <div class="dtp-time-col">
              <div class="dtp-time-col-label">Min</div>
              <div class="dtp-time-scroll" data-type="minute">
                ${minuteOptionsHtml}
              </div>
            </div>
            <div class="dtp-period-toggle">
              <button class="dtp-period-btn ${this.selectedPeriod === 'AM' ? 'dtp-period-btn--active' : ''}" data-period="AM" type="button">AM</button>
              <button class="dtp-period-btn ${this.selectedPeriod === 'PM' ? 'dtp-period-btn--active' : ''}" data-period="PM" type="button">PM</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();

    // Scroll selected options into view
    requestAnimationFrame(() => {
      this.container.querySelectorAll('.dtp-time-option--selected').forEach(el => {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    });
  }

  _bindEvents() {
    // Month navigation
    const prevBtn = this.container.querySelector('.dtp-prev-btn');
    const nextBtn = this.container.querySelector('.dtp-next-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.viewMonth--;
        if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
        this.render();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.viewMonth++;
        if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
        this.render();
      });
    }

    // Day selection
    this.container.querySelectorAll('.dtp-day--active').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const day = parseInt(el.dataset.day);
        this.selectedDay = day;
        this.selectedMonth = this.viewMonth;
        this.selectedYear = this.viewYear;
        this.render();
        this._fireChange();
      });
    });

    // Hour selection
    this.container.querySelectorAll('.dtp-time-option[data-hour]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedHour = parseInt(el.dataset.hour);
        this.render();
        this._fireChange();
      });
    });

    // Minute selection
    this.container.querySelectorAll('.dtp-time-option[data-minute]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedMinute = parseInt(el.dataset.minute);
        this.render();
        this._fireChange();
      });
    });

    // AM/PM toggle
    this.container.querySelectorAll('.dtp-period-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectedPeriod = el.dataset.period;
        this.render();
        this._fireChange();
      });
    });
  }
}
