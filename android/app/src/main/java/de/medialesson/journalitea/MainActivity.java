package de.medialesson.journalitea;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.community.database.sqlite.CapacitorSQLitePlugin;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(CapacitorSQLitePlugin.class);
		registerPlugin(JournaliteaHttpPlugin.class);
		registerPlugin(JournaliteaFilesPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
