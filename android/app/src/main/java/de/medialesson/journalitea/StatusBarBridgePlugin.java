package de.medialesson.journalitea;

import android.app.Activity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StatusBarBridge")
public class StatusBarBridgePlugin extends Plugin {
	@PluginMethod
	public void setDarkIcons(PluginCall call) {
		Boolean dark = call.getBoolean("dark");
		if (dark == null) {
			call.reject("Missing 'dark' flag");
			return;
		}
		Activity activity = getActivity();
		if (!(activity instanceof MainActivity)) {
			call.reject("Unsupported activity");
			return;
		}
		activity.runOnUiThread(() -> {
			((MainActivity) activity).setForceDarkIcons(dark);
			call.resolve();
		});
	}
}
