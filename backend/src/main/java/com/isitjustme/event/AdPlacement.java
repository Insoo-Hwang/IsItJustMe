package com.isitjustme.event;

/**
 * Spots on the site where an ad can be shown. A new spot is added here first, so the ad
 * report never counts a spot nobody defined.
 */
public enum AdPlacement {

	/** In place of a question, between questions 5 and 6 of a test. */
	QUIZ_BREAK,

	/** Under the title of the analyzing screen after the last question. */
	ANALYZING,

	/** A small card at the bottom of a category result. */
	RESULT_BANNER,

	/** A small card at the bottom of the overall result. */
	SUMMARY_BANNER,

	/** A small card under the ending letter. */
	ENDING_BANNER

}
