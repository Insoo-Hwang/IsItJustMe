package com.isitjustme.admin;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.isitjustme.mvp.MvpMode;
import com.isitjustme.mvp.NotifyEmailRepository;
import com.isitjustme.mvp.NotifyEmailRepository.NotifyEmail;
import com.isitjustme.site.MaintenanceMode;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Admin APIs. Every path under here needs the admin token ({@link AdminAuth}).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

	private final AdminDashboardRepository dashboardRepository;

	private final AdReportRepository adReportRepository;

	private final MaintenanceMode maintenance;

	private final MvpMode mvp;

	private final NotifyEmailRepository emailRepository;

	@GetMapping("/dashboard")
	public AdminDashboard dashboard(@RequestParam(defaultValue = "14") @Min(1) @Max(90) int days) {
		return dashboardRepository.dashboard(days, LocalDate.now(AdminDashboardRepository.ZONE));
	}

	/**
	 * @param ad one ad to break down; every ad together when left out
	 */
	@GetMapping("/ads")
	public AdReport ads(@RequestParam(defaultValue = "14") @Min(1) @Max(90) int days,
			@RequestParam(required = false) @Nullable @Pattern(regexp = "[a-z0-9-]{1,30}") String ad) {
		return adReportRepository.report(days, LocalDate.now(AdminDashboardRepository.ZONE), ad);
	}

	@GetMapping("/maintenance")
	public MaintenanceMode.State maintenance() {
		return maintenance.state();
	}

	/** Opens or closes the site for visitors; admin APIs stay open either way. */
	@PutMapping("/maintenance")
	public MaintenanceMode.State setMaintenance(@Valid @RequestBody MaintenanceRequest request,
			HttpServletRequest http) {
		MaintenanceMode.State state = maintenance.set(request.enabled(), request.message());
		// who switched the site and when, for later
		log.info("Maintenance {} by {}", state.enabled() ? "started" : "ended", http.getRemoteAddr());
		return state;
	}

	@GetMapping("/mvp")
	public MvpView mvp() {
		return mvpView(mvp.state());
	}

	/** Turns MVP mode on or off: off shows every number at once, whatever the count. */
	@PutMapping("/mvp")
	public MvpView setMvp(@RequestBody MvpRequest request, HttpServletRequest http) {
		MvpMode.State state = mvp.set(request.enabled());
		log.info("MVP mode {} by {}", state.enabled() ? "on" : "off", http.getRemoteAddr());
		return mvpView(state);
	}

	/** Addresses left to hear when the numbers open, to send that notice by hand. */
	@GetMapping("/mvp/emails")
	public List<NotifyEmail> mvpEmails() {
		return emailRepository.findAll();
	}

	private MvpView mvpView(MvpMode.State state) {
		return new MvpView(state.enabled(), state.locked(), state.goal(), state.completers(), emailRepository.count());
	}

	public record MvpRequest(boolean enabled) {
	}

	/**
	 * @param emails addresses left to hear when the numbers open
	 */
	public record MvpView(boolean enabled, boolean locked, int goal, long completers, long emails) {
	}

	/**
	 * @param message shown to visitors; the default message when empty
	 */
	public record MaintenanceRequest(boolean enabled, @Nullable @Size(max = 200) String message) {
	}

}
