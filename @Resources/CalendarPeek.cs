using System;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace CalendarPeek
{
    public enum PeekAction { None, Open, Close }

    // Time and input are supplied by the host, so behavior is testable without moving the mouse.
    public sealed class PeekState
    {
        readonly int openDelay, closeDelay;
        long entered = -1, left = -1;
        bool rearm;
        public bool IsOpen { get; private set; }
        public PeekState(int openDelayMs, int closeDelayMs) { openDelay = openDelayMs; closeDelay = closeDelayMs; }
        public void ResetDwell() { entered = -1; }
        public PeekAction Tick(long now, bool corner, bool inside, bool blocked, bool escape)
        {
            if (!corner) rearm = false;
            if (blocked || (escape && IsOpen))
            {
                entered = left = -1;
                rearm = corner;
                if (!IsOpen) return PeekAction.None;
                IsOpen = false;
                return PeekAction.Close;
            }
            if (IsOpen)
            {
                if (corner || inside) { left = -1; return PeekAction.None; }
                if (left < 0) left = now;
                if (now - left < closeDelay) return PeekAction.None;
                IsOpen = false;
                entered = left = -1;
                return PeekAction.Close;
            }
            if (!corner || rearm) { entered = -1; return PeekAction.None; }
            if (entered < 0) entered = now;
            if (now - entered < openDelay) return PeekAction.None;
            IsOpen = true;
            entered = left = -1;
            return PeekAction.Open;
        }
    }

    public sealed class Settings
    {
        public bool Enabled = true, SuppressFullscreen = true;
        public string Corner = "TopLeft", IdleMode = "Desktop";
        public int TriggerSize = 6, OpenDelayMs = 400, CloseDelayMs = 600;
        public static Settings Parse(string text)
        {
            Settings s = new Settings();
            bool section = false;
            foreach (string raw in text.Split('\n'))
            {
                string line = raw.Trim();
                if (line.StartsWith(";") || line.Length == 0) continue;
                if (line.StartsWith("[")) { section = line.Equals("[Variables]", StringComparison.OrdinalIgnoreCase) || line.Equals("[CalendarPeek]", StringComparison.OrdinalIgnoreCase); continue; }
                int equals = line.IndexOf('=');
                if (!section || equals < 1) continue;
                string key = line.Substring(0, equals).Trim().ToLowerInvariant();
                string value = line.Substring(equals + 1).Split(';')[0].Trim();
                int number;
                switch (key)
                {
                    case "enabled": if (value == "0" || value == "1") s.Enabled = value == "1"; break;
                    case "suppressfullscreen": if (value == "0" || value == "1") s.SuppressFullscreen = value == "1"; break;
                    case "corner":
                        foreach (string corner in new[] { "TopLeft", "TopRight", "BottomLeft", "BottomRight" })
                            if (corner.Equals(value, StringComparison.OrdinalIgnoreCase)) s.Corner = corner;
                        break;
                    case "idlemode":
                        if (value.Equals("Hidden", StringComparison.OrdinalIgnoreCase)) s.IdleMode = "Hidden";
                        else if (value.Equals("Desktop", StringComparison.OrdinalIgnoreCase)) s.IdleMode = "Desktop";
                        break;
                    case "triggersize": if (Int32.TryParse(value, out number) && number >= 1 && number <= 32) s.TriggerSize = number; break;
                    case "opendelayms": if (Int32.TryParse(value, out number) && number >= 100 && number <= 5000) s.OpenDelayMs = number; break;
                    case "closedelayms": if (Int32.TryParse(value, out number) && number >= 100 && number <= 5000) s.CloseDelayMs = number; break;
                }
            }
            return s;
        }
    }

    public static class Geometry
    {
        public static bool IsFullscreen(Rectangle frame, Rectangle monitor, bool normalWindow)
        {
            return !normalWindow && frame.Left <= monitor.Left && frame.Top <= monitor.Top && frame.Right >= monitor.Right && frame.Bottom >= monitor.Bottom;
        }
        public static bool AtCorner(Point p, Rectangle bounds, string corner, int size)
        {
            if (!bounds.Contains(p)) return false;
            bool x = corner.EndsWith("Left") ? p.X < bounds.Left + size : p.X >= bounds.Right - size;
            bool y = corner.StartsWith("Top") ? p.Y < bounds.Top + size : p.Y >= bounds.Bottom - size;
            return x && y;
        }
        public static Point PopupPosition(Rectangle work, string corner, int width, int height, int margin)
        {
            int x = corner.EndsWith("Left") ? work.Left + margin : work.Right - width - margin;
            int y = corner.StartsWith("Top") ? work.Top + margin : work.Bottom - height - margin;
            return new Point(Math.Max(work.Left, Math.Min(x, work.Right - width)), Math.Max(work.Top, Math.Min(y, work.Bottom - height)));
        }
    }

    public static class Native
    {
        [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; public Rectangle Bounds { get { return Rectangle.FromLTRB(Left, Top, Right, Bottom); } } }
        [StructLayout(LayoutKind.Sequential)] struct CopyData { public IntPtr Data; public int Size; public IntPtr Text; }
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string className, string title);
        [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
        [DllImport("user32.dll", EntryPoint = "GetPhysicalCursorPos")] public static extern bool GetCursorPos(out Point point);
        [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder text, int size);
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
        [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
        [DllImport("user32.dll")] static extern bool PhysicalToLogicalPointForPerMonitorDPI(IntPtr window, ref Point point);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr64(IntPtr window, int index);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong32(IntPtr window, int index);
        [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr window);
        [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out Rect rect, int size);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, ref CopyData data, uint flags, uint timeout, out IntPtr result);
        public static bool Down(int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; }
        public static void ConfigureDpi()
        {
            SetProcessDPIAware();
            try { if (SetThreadDpiAwarenessContext(new IntPtr(-4)) == IntPtr.Zero) SetThreadDpiAwarenessContext(new IntPtr(-3)); }
            catch (EntryPointNotFoundException) { }
        }
        public static bool MovePhysical(IntPtr window, Point physical)
        {
            // Use the caller's physical coordinate space. Rainmeter receives WM_MOVE and updates its position.
            // Avoid !Move, which would reinterpret these coordinates using Rainmeter's DPI awareness.
            return SetWindowPos(window, IntPtr.Zero, physical.X, physical.Y, 0, 0, 0x0015);
        }
        public static Point CurrentLogicalPosition(IntPtr window)
        {
            Rect rect;
            if (!GetWindowRect(window, out rect)) throw new InvalidOperationException("Cannot read calendar position.");
            // This conversion accepts a point in the CURRENT window, not a destination outside it.
            Point position = new Point(rect.Left, rect.Top);
            if (!PhysicalToLogicalPointForPerMonitorDPI(window, ref position)) throw new InvalidOperationException("Cannot save calendar position.");
            return position;
        }
        public static bool Bang(string command)
        {
            IntPtr control = FindWindow("DummyRainWClass", "Rainmeter control window");
            if (control == IntPtr.Zero) return false;
            IntPtr text = Marshal.StringToHGlobalUni(command);
            try
            {
                CopyData data = new CopyData { Data = new IntPtr(1), Size = (command.Length + 1) * 2, Text = text };
                IntPtr result;
                return SendMessageTimeout(control, 0x004A, IntPtr.Zero, ref data, 0x0002, 1000, out result) != IntPtr.Zero;
            }
            finally { Marshal.FreeHGlobal(text); }
        }
        public static bool Fullscreen(IntPtr skin)
        {
            IntPtr window = GetForegroundWindow();
            if (window == IntPtr.Zero || window == skin) return false;
            StringBuilder name = new StringBuilder(256);
            GetClassName(window, name, name.Capacity);
            if (name.ToString() == "Progman" || name.ToString() == "WorkerW" || name.ToString() == "Shell_TrayWnd") return false;
            Rect rect;
            if (!GetWindowRect(window, out rect)) return false;
            Rect visible;
            if (DwmGetWindowAttribute(window, 9, out visible, Marshal.SizeOf(typeof(Rect))) == 0) rect = visible;
            Rectangle monitor = Screen.FromHandle(window).Bounds;
            long style = IntPtr.Size == 8 ? GetWindowLongPtr64(window, -16).ToInt64() : GetWindowLong32(window, -16);
            bool normalWindow = (style & 0x00C00000) == 0x00C00000 || (IsZoomed(window) && (style & 0x00040000) != 0);
            return Geometry.IsFullscreen(rect.Bounds, monitor, normalWindow);
        }
    }

    public static class Controller
    {
        static string Number(int value) { return value.ToString(CultureInfo.InvariantCulture); }
        public static void Run(string skinPath, string configName, string settingsPath)
        {
            if (configName.IndexOfAny(new[] { '"', '[', ']', '\r', '\n' }) >= 0) throw new ArgumentException("Invalid skin config name.");
            string config = "\"" + configName + "\"";
            string statePath = Path.Combine(Path.GetDirectoryName(settingsPath), "CalendarPeek.state");
            Settings settings = Settings.Parse(File.Exists(settingsPath) ? File.ReadAllText(settingsPath) : "");
            Native.ConfigureDpi();
            IntPtr skin = Native.FindWindow("RainmeterMeterWindow", skinPath);
            if (skin == IntPtr.Zero) throw new InvalidOperationException("Calendar skin window was not found.");
            string identity;
            using (var sha = System.Security.Cryptography.SHA256.Create())
                identity = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(skinPath.ToLowerInvariant()))).Replace("-", "");
            using (Mutex mutex = new Mutex(false, "Local\\CalendarPeek-" + identity))
            {
                bool owns;
                try { owns = mutex.WaitOne(2000); } catch (AbandonedMutexException) { owns = true; }
                if (!owns) return;
                try { Monitor(skin, config, statePath, settings); }
                finally { mutex.ReleaseMutex(); }
            }
        }
        static void Monitor(IntPtr skin, string config, string statePath, Settings settings)
        {
            Native.Rect rect;
            if (!Native.GetWindowRect(skin, out rect)) return;
            Point home = new Point(rect.Left, rect.Top);
            if (File.Exists(statePath))
            {
                string[] xy = File.ReadAllText(statePath).Split(',');
                int x, y;
                if (xy.Length == 2 && Int32.TryParse(xy[0], out x) && Int32.TryParse(xy[1], out y)) home = new Point(x, y);
                if (Idle(skin, home, config, settings)) File.Delete(statePath);
            }
            if (!settings.Enabled) { Idle(skin, home, config, new Settings()); return; }
            if (!Idle(skin, home, config, settings)) throw new InvalidOperationException("Rainmeter did not accept the startup command.");
            PeekState state = new PeekState(settings.OpenDelayMs, settings.CloseDelayMs);
            Stopwatch clock = Stopwatch.StartNew();
            string previousMonitor = null;
            try
            {
                while (Native.IsWindow(skin))
                {
                    Point cursor;
                    if (!Native.GetCursorPos(out cursor)) { state.ResetDwell(); Thread.Sleep(50); continue; }
                    Screen screen = Screen.FromPoint(cursor);
                    if (previousMonitor != screen.DeviceName) state.ResetDwell();
                    previousMonitor = screen.DeviceName;
                    bool corner = Geometry.AtCorner(cursor, screen.Bounds, settings.Corner, settings.TriggerSize);
                    bool inside = state.IsOpen && Native.GetWindowRect(skin, out rect) && rect.Bounds.Contains(cursor);
                    bool dragging = Native.Down(1) || Native.Down(2) || Native.Down(4);
                    bool blocked = (settings.SuppressFullscreen && Native.Fullscreen(skin)) || (!state.IsOpen && dragging);
                    PeekAction action = state.Tick(clock.ElapsedMilliseconds, corner, inside, blocked, Native.Down(27));
                    if (action == PeekAction.Open)
                    {
                        if (!Native.GetWindowRect(skin, out rect)) break;
                        if (settings.IdleMode == "Desktop") home = new Point(rect.Left, rect.Top);
                        Point position = Geometry.PopupPosition(screen.WorkingArea, settings.Corner, rect.Right - rect.Left, rect.Bottom - rect.Top, 12);
                        File.WriteAllText(statePath, Number(home.X) + "," + Number(home.Y));
                        if (!Native.MovePhysical(skin, position) || !Native.Bang("[!ZPos 1 " + config + "][!Show " + config + "]")) break;
                    }
                    else if (action == PeekAction.Close)
                    {
                        if (!Idle(skin, home, config, settings)) break;
                        File.Delete(statePath);
                    }
                    Thread.Sleep(50);
                }
            }
            finally
            {
                if (Native.IsWindow(skin) && Idle(skin, home, config, settings)) File.Delete(statePath);
            }
        }
        static bool Idle(IntPtr skin, Point home, string config, Settings settings)
        {
            if (!Native.MovePhysical(skin, home)) return false;
            Point logical = Native.CurrentLogicalPosition(skin);
            // Save the restored desktop location, including after a user drags the temporary popup.
            return Native.Bang("[!Hide " + config + "][!Move " + Number(logical.X) + " " + Number(logical.Y) + " " + config + "][!ZPos -2 " + config + "]" + (settings.IdleMode == "Desktop" ? "[!Show " + config + "]" : ""));
        }
    }
}
