var cc = DataStudioApp.createCommunityConnector();

function parseJsonResponse(response) {
    var content = response.getContentText('UTF-8');
    return JSON.parse(content);
}

function getOptionValuesFromInstance() {
    var userProperties = PropertiesService.getUserProperties();
    var instanceUrl = userProperties.getProperty('dscc.username');
    var token = userProperties.getProperty('dscc.token');

    var responses = UrlFetchApp.fetchAll([
        instanceUrl + 'index.php?module=API&method=SitesManager.getSitesWithAtLeastViewAccess&format=JSON&token_auth=' + encodeURIComponent(token),
        instanceUrl + 'index.php?module=API&method=SegmentEditor.getAll&format=JSON&token_auth=' + encodeURIComponent(token),
        instanceUrl + 'index.php?module=API&method=API.getReportMetadata&idSites=all&period=day&date=yesterday&idSite=1&format=JSON&token_auth=' + encodeURIComponent(token)
    ]);

    var sitesWithViewAccess = parseJsonResponse(responses[0]);
    var segments = parseJsonResponse(responses[1]);
    var reports = parseJsonResponse(responses[2]);

    return {
        sitesWithViewAccess: sitesWithViewAccess,
        segments: segments,
        reports: reports,
    };
}

function getReportMetadata(request) {
    var userProperties = PropertiesService.getUserProperties();
    var instanceUrl = userProperties.getProperty('dscc.username');
    var token = userProperties.getProperty('dscc.token');

    var idSite = request.idsite || request.configParams.idsite || 1;
    var report = request.report || request.configParams.report || 'VisitsSummary.get';

    var parts = report.split('.');
    var apiModule = parts[0];
    var apiAction = parts[1];

    var response = UrlFetchApp.fetch(instanceUrl + '/index.php?module=API&method=API.getMetadata&idSite=' + encodeURIComponent(idSite) + '&apiModule='
        + encodeURIComponent(apiModule) + '&apiAction=' + encodeURIComponent(apiAction) + '&period=day&date=today&format=JSON&token_auth=' + encodeURIComponent(token));

    var result = parseJsonResponse(response);
    if (Array.isArray(result)) {
        result = result[0];
    }
    return result;
}

function getProcessedReport(request) {
    var userProperties = PropertiesService.getUserProperties();
    var instanceUrl = userProperties.getProperty('dscc.username');
    var token = userProperties.getProperty('dscc.token');

    var idSite = request.idsite || request.configParams.idsite || 1;
    var report = request.report || request.configParams.report || 'VisitsSummary.get';

    var parts = report.split('.');
    var apiModule = parts[0];
    var apiAction = parts[1];

    var period = 'range';
    var date = request.dateRange.startDate + ',' + request.dateRange.endDate;

    var response = UrlFetchApp.fetch(instanceUrl + 'index.php?' + [
        'module=API',
        'method=API.getProcessedReport',
        'idSite=' + encodeURIComponent(idSite),
        'period=' + encodeURIComponent(period),
        'date=' + encodeURIComponent(date),
        'apiModule=' + encodeURIComponent(apiModule),
        'apiAction=' + encodeURIComponent(apiAction),
        'format=JSON',
        'token_auth=' + encodeURIComponent(token),
        'format_metrics=0',
        'flat=1',
    ].join('&'));

    var result = parseJsonResponse(response);
    if (Array.isArray(result)) {
        result = result[0];
    }
    return result;
}

function getConfig() {
    var config = cc.getConfig();

    var metadata = getOptionValuesFromInstance();
    var sitesWithViewAccess = metadata.sitesWithViewAccess;
    var segments = metadata.segments;
    var reports = metadata.reports;

    // idsite select
    var idSiteSelect = config
        .newSelectSingle()
        .setId('idsite')
        .setName('Website/Measurable')
        .setAllowOverride(true);

    sitesWithViewAccess.forEach(function (site) {
        idSiteSelect = idSiteSelect.addOption(config.newOptionBuilder().setLabel(site.name).setValue(site.idsite));
    });

    // segment select
    var segmentSelect = config
        .newSelectSingle()
        .setId('segment')
        .setName('Segment')
        .setAllowOverride(true)
        .addOption(config.newOptionBuilder().setLabel('All Visits').setValue(''));

    segments.forEach(function (segment) {
        segmentSelect = segmentSelect.addOption(config.newOptionBuilder().setLabel(segment.name).setValue(segment.definition));
    });

    // report select
    var reportSelect = config
        .newSelectSingle()
        .setId('report')
        .setName('Report')
        .setAllowOverride(true);

    reports.forEach(function (report) {
        reportSelect = reportSelect.addOption(config.newOptionBuilder().setLabel(report.name).setValue(report.module + '.' + report.action));
    });

    config.setDateRangeRequired(true);

    return config.build();
}

function isPercent(name) {
    return /_rate$/.test(name);
}

function isUniqueCount(name) {
    return /uniq_/.test(name);
}

function isAverage(name) {
    return /avg_/.test(name);
}

function addMetric(fields, id, name) {
    console.log('addMetric', id, name);

    var types = cc.FieldType;
    var aggregations = cc.AggregationType;

    var type = types.NUMBER;
    var aggregation = aggregations.SUM;

    if (isPercent(name)) {
        type = types.PERCENT;
    } else if (isUniqueCount(name)) {
        aggregation = aggregations.NONE;
    } else if (isAverage(name)) { // TODO: not sure if this is correct
        aggregation = aggregations.AVG;
    }

    fields
        .newMetric()
        .setId(id)
        .setName(name)
        .setType(type)
        .setAggregation(aggregation);
}

function addDimension(fields, module, dimension) {
    console.log('addDimension', module, dimension);

    var types = cc.FieldType;

    fields
        .newDimension()
        .setId('label')
        .setName(dimension)
        .setType(types.TEXT);
}

function getFieldsFromReportMetadata(reportMetadata, requestedFields) {
    var fields = cc.getFields();

    if (reportMetadata.dimension && (!requestedFields || requestedFields.includes('label'))) {
        addDimension(fields, reportMetadata.module, reportMetadata.dimension);
    }

    [].concat(
        Object.entries(reportMetadata.metrics),
        Object.entries(reportMetadata.processedMetrics),
        // TODO: not supported in poc
        // Object.entries(reportMetadata.metricsGoal),
        // Object.entries(reportMetadata.processedMetricsGoal),
    ).forEach(function (entry) {
        if (!requestedFields || requestedFields.includes(entry[0])) {
            addMetric(fields, entry[0], entry[1]);
        }
    });

    return fields;
}

function getSchema(request) {
    console.log('getSchema', request);

    var reportMetadata = getReportMetadata(request);
    console.log('reportMetadata', reportMetadata);

    var fields = getFieldsFromReportMetadata(reportMetadata);

    return { schema: fields.build() };
}

function getData(request) {
    console.log('getData', request);

    var processedReport = getProcessedReport(request);
    // console.log('processedReport', processedReport);

    var fields = getFieldsFromReportMetadata(processedReport.metadata, request.fields.map(function (r) { return r.name; }));

    var data = processedReport.reportData.map(function (row) {
        return {
            values: request.fields.map(function (requestedField) {
                return (row[requestedField.name] || '').toString();
            }),
        };
    });

    var result = {
        schema: fields.build(),
        rows: data,
        filtersApplied: false
    };
    console.log(result);
    return result;
}
