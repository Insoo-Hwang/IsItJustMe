package com.isitjustme.site;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * During maintenance every visitor API answers 503 with the message to show, so the page
 * can say why instead of failing. Admin APIs stay open to switch it back. The switch is
 * made here, so every web slice that loads this guard also has it.
 */
@Configuration
public class MaintenanceGuard implements WebMvcConfigurer, HandlerInterceptor {

	private final MaintenanceMode maintenance;

	public MaintenanceGuard(@Value("${site.maintenance:false}") boolean enabled) {
		this.maintenance = new MaintenanceMode(enabled);
	}

	@Bean
	MaintenanceMode maintenanceMode() {
		return maintenance;
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(this).addPathPatterns("/api/**").excludePathPatterns("/api/v1/admin/**");
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
			throws IOException {
		MaintenanceMode.State state = maintenance.state();
		if (!state.enabled()) {
			return true;
		}
		response.setStatus(HttpStatus.SERVICE_UNAVAILABLE.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		response.getWriter().write("{\"maintenance\":true,\"message\":" + quote(state.message()) + "}");
		return false;
	}

	/** A JSON string literal of {@code text}. */
	static String quote(String text) {
		StringBuilder out = new StringBuilder("\"");
		for (char c : text.toCharArray()) {
			switch (c) {
				case '"' -> out.append("\\\"");
				case '\\' -> out.append("\\\\");
				case '\n' -> out.append("\\n");
				case '\r' -> out.append("\\r");
				case '\t' -> out.append("\\t");
				default -> {
					if (c < 0x20) {
						out.append(String.format("\\u%04x", (int) c));
					}
					else {
						out.append(c);
					}
				}
			}
		}
		return out.append('"').toString();
	}

}
