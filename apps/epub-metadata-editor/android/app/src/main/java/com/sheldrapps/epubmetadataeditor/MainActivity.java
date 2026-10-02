package com.sheldrapps.epubmetadataeditor;

import com.getcapacitor.BridgeActivity;
import com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(EpubRewritePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
