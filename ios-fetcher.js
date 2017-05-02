var async = require('async');
var request = require('request');
var XMLParser = require('xml2js');
var Review = require('./review');
var LocaleHelper = require('./LocaleHelper');
var localeHelper = new LocaleHelper();

module.exports = class IOSFetcher {

	constructor(config) {
		this.config = config;
	}

	fetchReviews(completion) {
		var self = this;

		self.review_array = [];
		var fetchActions = [];

		self.config.countries.forEach(function (country) {
			fetchActions.push(function (callback) {
				self.fetchReviewsForCountry(country, callback);
			});
		});

		async.parallel(fetchActions, function (err, results) {
			var review_array = [];
			if (results && results.length > 0) {
				results.forEach(function (result) {
					review_array = review_array.concat(result);
				});
				completion(review_array);
			} else {
				completion([]);
			}
		});
	}

	fetchReviewsForCountry(country, completion) {
		var self = this;
		var review_array = [];
		request(self.getRequestURLForCountry(country), function (error, response, body) {
			if (error || response.statusCode != 200) {
				completion(null, []);
				return;
			}

			XMLParser.parseString(body, function (err, result) {
				var entries = result.feed.entry;
				if (entries === undefined) {
					completion(null, []);
					return;
				}

				entries.forEach(function (reviewJS) {
					self.parseResponseForCountry(reviewJS, country, function (review) {
						review_array.push(review);
					});
				});
				completion(null, review_array);
			});
		});
	}

	parseResponseForCountry(review, country, completion) {
		var self = this;
		var rating = parseFloat(review['im:rating']);
		if (!rating) {
			return;
		}
		var deviceInfo = {};
		var appInfo = {};
		var reviewInfo = {};

		reviewInfo.id = review.id[0];
		reviewInfo.text = review.content[0]._;
		reviewInfo.title = review.title[0];
		reviewInfo.author = review.author ? review.author[0].name[0] : false;
		reviewInfo.dateTime = new Date(review.updated);
		reviewInfo.rating = rating;
		reviewInfo.source = 'RSS';
		appInfo.id = self.config.iosId;
		appInfo.version = review['im:version'][0];
		deviceInfo.platform = 'iOS';
		deviceInfo.countryCode = country;

		localeHelper.getCountry(country, function (countryHeader) {
			deviceInfo.country = countryHeader;
			completion(new Review(deviceInfo, appInfo, reviewInfo));
		});
	}

	getRequestURLForCountry(country) {
		return 'https://itunes.apple.com/' + country + '/rss/customerreviews/page=1/id=' + this.config.iosId + '/sortby=mostrecent/xml';
	}
};