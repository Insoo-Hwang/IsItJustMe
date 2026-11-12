package com.isitjustme.admin;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

/**
 * Admin APIs. Every path under here needs the admin token ({@link AdminAuth}).
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

	private final AdminDashboardRepository dashboardRepository;

	@GetMapping("/dashboard")
	public AdminDashboard dashboard(@RequestParam(defaultValue = "14") @Min(1) @Max(90) int days) {
		return dashboardRepository.dashboard(days, LocalDate.now(AdminDashboardRepository.ZONE));
	}

}
