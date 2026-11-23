$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class WidgetDesktop
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X, Y; }

    [DllImport("user32.dll")] private static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] private static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string name);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetParent(IntPtr window, IntPtr parent);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    private static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    private static extern int SetWindowLong(IntPtr window, int index, int value);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] private static extern bool ScreenToClient(IntPtr window, ref Point point);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);

    private static IntPtr FindDesktopView()
    {
        IntPtr view = FindWindowEx(GetShellWindow(), IntPtr.Zero, "SHELLDLL_DefView", null);
        if (view != IntPtr.Zero) return view;
        IntPtr worker = IntPtr.Zero;
        while ((worker = FindWindowEx(IntPtr.Zero, worker, "WorkerW", null)) != IntPtr.Zero)
        {
            view = FindWindowEx(worker, IntPtr.Zero, "SHELLDLL_DefView", null);
            if (view != IntPtr.Zero) return view;
        }
        throw new InvalidOperationException("Windows desktop view was not found.");
    }

    public static void ChangeParent(long handle, bool attach)
    {
        const int styleIndex = -16;
        const int child = 0x40000000;
        const int popup = unchecked((int)0x80000000);
        const uint noSize = 0x0001, noActivate = 0x0010, frameChanged = 0x0020;
        IntPtr window = new IntPtr(handle);
        IntPtr parent = attach ? FindDesktopView() : IntPtr.Zero;
        int style = GetWindowLong(window, styleIndex);
        Rect rect;
        if (!GetWindowRect(window, out rect)) throw new InvalidOperationException("Widget window was not found.");
        Point position = new Point { X = rect.Left, Y = rect.Top };
        if (attach && !ScreenToClient(parent, ref position))
            throw new InvalidOperationException("Could not map the widget position to the desktop.");

        if (attach) SetWindowLong(window, styleIndex, (style & ~popup) | child);
        SetParent(window, parent);
        IntPtr actualParent = GetAncestor(window, 1);
        if (attach ? actualParent != parent : actualParent != IntPtr.Zero && actualParent != GetDesktopWindow())
        {
            SetWindowLong(window, styleIndex, style);
            throw new InvalidOperationException("Windows refused to change the widget parent.");
        }
        if (!attach) SetWindowLong(window, styleIndex, (style & ~child) | popup);
        SetWindowPos(window, IntPtr.Zero, position.X, position.Y, 0, 0, noSize | noActivate | frameChanged);
    }
}
'@

[WidgetDesktop]::ChangeParent($widgetHandle, $attachToDesktop)
