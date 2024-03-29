== Changelog ===

= 1.0.5 =
* Change the Help URL of the Login form to go directly to the connection guide.
* Add a warning if a user tries connecting with a pre-4.14 version Matomo.
* Use the showColumns parameter to lessen the amount of data returned by Matomo.
* Make sure to apply filter_truncate on the last request when a Default Row Limit is set.
* Improve Matomo API request error handling and retry logic.
* Better handling of the Default Row Limit setting.

= 1.0.4 =
* Reduce number of rows fetched at a time again.
* Do not silence JSON.parse failures when processing Matomo API response data.

= 1.0.3 =
* Fix error that can occur in App Script when requesting too many rows from a report that has a summary or totals row.
* Add link to report template FAQ in configuration section.

= 1.0.2 =
* Fix bug where the segment was not being applied.

= 1.0.1 =
* Support Matomo instance URLs like `http://myuser:mypass@mymatomo.com/`.
* Fix bug where data was incorrectly queried when the period matched a recognized Matomo period exactly (ie, week, month or year).

= 1.0.0 =
* Initial launch of Matomo Connector for Looker Studio.
