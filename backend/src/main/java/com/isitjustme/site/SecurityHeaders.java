package com.isitjustme.site;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Browser protections on every response: no framing by other sites (clickjacking), no
 * content-type guessing, no full addresses in the Referer, no camera or location, and a
 * content policy that only runs this site's own scripts. The fonts and icons come from
 * Google Fonts and jsDelivr, so those are allowed for styles and fonts only.
 */
@Component
public class SecurityHeaders extends OncePerRequestFilter {

	static final String CONTENT_POLICY = String.join("; ", "default-src 'self'", "script-src 'self'",
			// React sets style attributes; the stylesheets of the fonts and icons are external
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
			"font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
			// the taste card is drawn to a canvas and saved as a data or blob image
			"img-src 'self' data: blob:", "connect-src 'self'", "object-src 'none'", "base-uri 'self'",
			"form-action 'self'", "frame-ancestors 'none'");

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		response.setHeader("Content-Security-Policy", CONTENT_POLICY);
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader("X-Frame-Options", "DENY");
		response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
		response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
		chain.doFilter(request, response);
	}

}
