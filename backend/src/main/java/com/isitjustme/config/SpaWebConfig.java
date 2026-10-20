package com.isitjustme.config;

import java.io.IOException;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the React build (classpath:/static) and falls back to index.html
 * for client-side routes, so deep links like /result/abc work on refresh.
 */
@Configuration
public class SpaWebConfig implements WebMvcConfigurer {

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		registry.addResourceHandler("/**")
			.addResourceLocations("classpath:/static/")
			.resourceChain(true)
			.addResolver(new PathResourceResolver() {
				@Override
				protected Resource getResource(String resourcePath, Resource location) throws IOException {
					Resource requested = location.createRelative(resourcePath);
					if (requested.exists() && requested.isReadable()) {
						return requested;
					}
					// unknown API paths and missing files stay 404
					if (resourcePath.startsWith("api/") || resourcePath.contains(".")) {
						return null;
					}
					Resource index = location.createRelative("index.html");
					return index.exists() ? index : null;
				}
			});
	}

}
