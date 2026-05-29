package de.medialesson.journalitea;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

@CapacitorPlugin(name = "JournaliteaHttp")
public class JournaliteaHttpPlugin extends Plugin {
    private final OkHttpClient client = new OkHttpClient();

    @PluginMethod
    public void request(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Missing request URL.");
            return;
        }

        String method = call.getString("method", "GET");
        if (method == null || method.trim().isEmpty()) {
            method = "GET";
        }
        method = method.trim().toUpperCase();

        JSObject headerObject = call.getObject("headers", new JSObject());
        Headers.Builder headersBuilder = new Headers.Builder();
        if (headerObject != null) {
            Iterator<String> keys = headerObject.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = headerObject.opt(key);
                if (value != null) {
                    headersBuilder.add(key, String.valueOf(value));
                }
            }
        }

        Request.Builder requestBuilder = new Request.Builder()
            .url(url)
            .headers(headersBuilder.build());

        String body = call.getString("body");
        RequestBody requestBody = buildRequestBody(method, headerObject, body);

        try {
            requestBuilder.method(method, requestBody);
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage());
            return;
        }

        client.newCall(requestBuilder.build()).enqueue(new Callback() {
            @Override
            public void onFailure(Call callRequest, IOException error) {
                call.reject(error.getMessage(), error);
            }

            @Override
            public void onResponse(Call callRequest, Response response) throws IOException {
                JSObject payload = new JSObject();
                payload.put("status", response.code());
                payload.put("ok", response.isSuccessful());

                JSObject headers = new JSObject();
                for (String name : response.headers().names()) {
                    headers.put(name, response.header(name));
                }
                payload.put("headers", headers);

                ResponseBody responseBody = response.body();
                payload.put("data", responseBody != null ? responseBody.string() : "");
                call.resolve(payload);
            }
        });
    }

    private RequestBody buildRequestBody(String method, JSObject headers, String body) {
        if (body != null) {
            String contentType = "text/plain; charset=utf-8";
            if (headers != null) {
                String explicitContentType = headers.optString("Content-Type", null);
                if (explicitContentType == null || explicitContentType.isEmpty()) {
                    explicitContentType = headers.optString("content-type", "");
                }
                if (explicitContentType != null && !explicitContentType.isEmpty()) {
                    contentType = explicitContentType;
                }
            }
            MediaType mediaType = MediaType.parse(contentType);
            return RequestBody.create(body.getBytes(StandardCharsets.UTF_8), mediaType);
        }

        if (requiresRequestBody(method)) {
            return RequestBody.create(new byte[0], null);
        }

        return null;
    }

    private boolean requiresRequestBody(String method) {
        return "POST".equals(method)
            || "PUT".equals(method)
            || "PATCH".equals(method)
            || "PROPPATCH".equals(method)
            || "REPORT".equals(method);
    }
}