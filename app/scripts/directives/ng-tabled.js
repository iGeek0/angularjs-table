'use strict';

angular.module('andyperlitch.ngTabled', [])

.service('tabledFilterFunctions', function() {

  function like(term, value) {
    term = term.toLowerCase().trim();
    value = value.toLowerCase();
    var first = term[0];

    // negate
    if (first === '!') {
      term = term.substr(1);
      if (term === '') {
        return true;
      }
      return value.indexOf(term) === -1;
    }

    // strict
    if (first === '=') {
      term = term.substr(1);
      return term === value.trim();
    }

    // remove escaping backslashes
    term = term.replace('\\!', '!');
    term = term.replace('\\=', '=');

    return value.indexOf(term) !== -1;
  }
  function likeFormatted(term, value, computedValue, row) {
    return like(term,computedValue,computedValue, row);
  }
  function number(term, value) {
    value = parseFloat(value);
    term = term.trim();
    var first_two = term.substr(0,2);
    var first_char = term[0];
    var against_1 = term.substr(1)*1;
    var against_2 = term.substr(2)*1;
    if ( first_two === '<=' ) {
      return value <= against_2 ;
    }
    if ( first_two === '>=' ) {
      return value >= against_2 ;
    }
    if ( first_char === '<' ) {
      return value < against_1 ;
    }
    if ( first_char === '>' ) {
      return value > against_1 ;
    }
    if ( first_char === '~' ) {
      return Math.round(value) === against_1 ;
    }
    if ( first_char === '=' ) {
      return against_1 === value ;
    }
    return value.toString().indexOf(term.toString()) > -1 ;
  }
  function numberFormatted(term, value, computedValue) {
    return number(term, computedValue);
  }
  var unitmap = {};
  unitmap.second = unitmap.sec = unitmap.s = 1000;
  unitmap.minute = unitmap.min = unitmap.m = unitmap.second * 60;
  unitmap.hour = unitmap.hr = unitmap.h    = unitmap.minute * 60;
  unitmap.day = unitmap.d                  = unitmap.hour * 24;
  unitmap.week = unitmap.wk = unitmap.w    = unitmap.day * 7;
  unitmap.month                            = unitmap.week * 4;
  unitmap.year = unitmap.yr = unitmap.y    = unitmap.day * 365;

  var clauseExp = /(\d+(?:\.\d+)?)\s*([a-z]+)/;
  function parseDateFilter(string) {

    // split on clauses (if any)
    var clauses = string.trim().split(',');
    var total = 0;
    // parse each clause
    for (var i = 0; i < clauses.length; i++) {
      var clause = clauses[i].trim();
      var terms = clauseExp.exec(clause);
      if (!terms) {
        continue;
      }
      var count = terms[1]*1;
      var unit = terms[2].replace(/s$/, '');
      if (! unitmap.hasOwnProperty(unit) ) {
        continue;
      }
      total += count * unitmap[unit];
    }
    return total;
    
  }
  function date(term, value) {
    // today
    // yesterday
    // 1 day ago
    // 2 days ago

    // < 1 day ago
    // < 10 minutes ago
    // < 10 min ago
    // < 10 minutes, 50 seconds ago
    // > 10 min, 30 sec ago
    // > 2 days ago
    // >= 1 day ago
    term = term.trim();
    if (!term) {
      return true;
    }
    value *= 1;
    var nowDate = new Date();
    var now = (+nowDate);
    var first_char = term[0];
    var other_chars = (term.substr(1)).trim();
    var lowerbound, upperbound;
    if ( first_char === '<' ) {
      lowerbound = now - parseDateFilter(other_chars);
      return value > lowerbound;
    }
    if ( first_char === '>' ) {
      upperbound = now - parseDateFilter(other_chars);
      return value < upperbound;
    }
    
    if ( term === 'today') {
      return new Date(value).toDateString() === nowDate.toDateString();
    }

    if ( term === 'yesterday') {
      return new Date(value).toDateString() === new Date(now - unitmap.d).toDateString();
    }

    var supposedDate = new Date(term);
    if (!isNaN(supposedDate)) {
      return new Date(value).toDateString() === supposedDate.toDateString();
    }

    return false;
  }

  return {
    like: like,
    likeFormatted: likeFormatted,
    number: number,
    numberFormatted: numberFormatted,
    date: date
  };
})

.service('tabledFormatFunctions', function() {
  return {};
})

.service('tabledSortFunctions', function() {
  return {
    number: function(field){
      return function(row1,row2) {
        return row1[field] - row2[field];
      };
    },
    string: function(field){
      return function(row1,row2) {
        if ( row1[field].toString().toLowerCase() === row2[field].toString().toLowerCase() ) {
          return 0;
        }
        return row1[field].toString().toLowerCase() > row2[field].toString().toLowerCase() ? 1 : -1 ;
      };
    }
  };
})

.filter('tabledRowFilter', ['tabledFilterFunctions', '$log', function(tabledFilterFunctions, $log) {
  return function tabledRowFilter(rows, columns, searchTerms) {

    var enabledFilterColumns, result = rows;

    // gather enabled filter functions
    enabledFilterColumns = columns.filter(function(column) {
      // check search term
      var term = searchTerms[column.id];
      if (searchTerms.hasOwnProperty(column.id) && typeof term === 'string') {

        // filter empty strings and whitespace
        if (!term.trim()) {
          return false;
        }
        
        // check search filter function
        if (typeof column.filter === 'function') {
          return true;
        }
        // not a function, check for predefined filter function
        var predefined = tabledFilterFunctions[column.filter];
        if (typeof predefined === 'function') {
          column.filter = predefined;
          return true;
        }
        $log.warn('ngTabled: The filter function "'+column.filter+'" ' +
          'specified by column(id='+column.id+').filter ' +
          'was not found in predefined tabledFilterFunctions. ' +
          'Available filters: "'+Object.keys(tabledFilterFunctions).join('","')+'"');
      }
      return false;
    });

    // loop through rows and filter on every enabled function
    if (enabledFilterColumns.length) {
      result = rows.filter(function(row) {
        for (var i = enabledFilterColumns.length - 1; i >= 0; i--) {
          var col = enabledFilterColumns[i];
          var filter = col.filter;
          var term = searchTerms[col.id];
          var value = row[col.key];
          var computedValue = typeof col.format === 'function' ? col.format(value) : value;
          if (!filter(term, value, computedValue, row)) {
            return false;
          }
        }
        return true;
      });
    }

    return result;
  };
}])

.filter('tabledCellFilter', function() {
  return function tabledCellFilter(row, column) {

    // check if property is available on the row    
    var hasProp = row.hasOwnProperty(column.key);
    if (!hasProp) {
      return column.defaultValue || '';
    }

    // cache raw data value
    var value = row[column.key];

    // check for format
    var format = column.format;
    if (typeof format === 'function') {
      return format(value, row, column);
    }

    return value;
  };
})

.filter('tabledRowSorter', function() {
  var column_cache = {};
  function getColumn(columns,id) {
    if (column_cache.hasOwnProperty(id)) {
      return column_cache[id];
    }
    for (var i = columns.length - 1; i >= 0; i--) {
      if (columns[i].id === id) {
        column_cache[id] = columns[i];
        return columns[i];
      }
    }
  }
  return function tabledRowSorter(rows, columns, sortOrder, sortDirection) {
    if (!sortOrder.length) {
      return rows;
    }
    var arrayCopy = [];
    for ( var i = 0; i < rows.length; i++) { arrayCopy.push(rows[i]); }
    return arrayCopy.sort(function(a,b) {
      for (var i = 0; i < sortOrder.length; i++) {
        var id = sortOrder[i];
        var column = getColumn(columns,id);
        var dir = sortDirection[id];
        if (column && column.sort) {
          
          var fn = column.sort;
          var result = dir === '+' ? fn(a,b) : fn(b,a);
          if (result !== 0) {
            return result;
          }

        }
      }
      return 0;
    });
  };
})

.controller('TabledController', ['$scope','tabledFormatFunctions','tabledSortFunctions','tabledFilterFunctions','$log', function($scope, formats, sorts, filters, $log) {

  // SCOPE FUNCTIONS
  $scope.addSort = function(id, dir) {
    var idx = $scope.sortOrder.indexOf(id);
    if (idx === -1) {
      $scope.sortOrder.push(id);
    }
    $scope.sortDirection[id] = dir;
  };
  $scope.removeSort = function(id) {
    var idx = $scope.sortOrder.indexOf(id);
    if (idx !== -1) {
      $scope.sortOrder.splice(idx, 1);
    }
    delete $scope.sortDirection[id];
  };
  $scope.clearSort = function() {
    $scope.sortOrder = [];
    $scope.sortDirection = {};
  };
  // Checks if columns have any filter fileds
  $scope.hasFilterFields = function() {
    for (var i = $scope.columns.length - 1; i >= 0; i--) {
      if (typeof $scope.columns[i].filter !== 'undefined') {
        return true;
      }
    }
    return false;
  };
  // Toggles column sorting
  $scope.toggleSort = function($event, column) {

    // check if even sortable
    if (!column.sort) {
      return;
    }

    if ( $event.shiftKey ) {
      // shift is down, ignore other columns
      // but toggle between three states
      switch ($scope.sortDirection[column.id]) {
        case '+':
          // Make descending
          $scope.sortDirection[column.id] = '-';
          break;
        case '-':
          // Remove from sortOrder and direction
          $scope.removeSort(column.id);
          break;
        default:
          // Make ascending
          $scope.addSort(column.id, '+');
          break;
      }

    } else {
      // shift is not down, disable other
      // columns but toggle two states
      var lastState = $scope.sortDirection[column.id];
      $scope.clearSort();
      if (lastState === '+') {
        $scope.addSort(column.id, '-');
      }
      else {
        $scope.addSort(column.id, '+');
      }
      
    }
  };
  // Retrieve className for given sorting state
  $scope.getSortClass = function(sorting) {
    var classes = $scope.options.sort_classes;
    if (sorting === '+') {
      return classes[1];
    }
    if (sorting === '-') {
      return classes[2];
    }
    return classes[0];
  };
  $scope.setColumns = function(columns) {
    $scope.columns = columns;
    var column_lookups = { format: formats, sort: sorts, filter: filters };
    $scope.columns.forEach(function(column) {
      angular.forEach(column_lookups, function(builtins, key) {
        var attr = column[key];
        if (typeof attr === 'function') {
          return;
        }
        if (typeof attr === 'string') {
          if (typeof builtins[attr] === 'function') {
            column[key] = key === 'sort' ? builtins[attr](column.key) : builtins[attr];  
          }
          else {
            delete column[key];
            $log.warn(key + ' function reference in column(id=' + column.id + ') ' +
                  'was not found in built-in ' + key + ' functions. ' +
                  key + ' function given: "' + attr + '". ' +
                  'Available built-ins: ' + Object.keys(builtins).join(','));  
          }
          
        } else {
          delete column[key];
        }
      });
    });
  };

  // Set configuration options
  $scope.options = {
    sort_classes: [
      'glyphicon glyphicon-sort',
      'glyphicon glyphicon-chevron-up',
      'glyphicon glyphicon-chevron-down'
    ]
  };
  // Look for built-in filter, sort, and format functions
  if ($scope.columns instanceof Array) {
    $scope.setColumns($scope.columns);
  } else {
    $log.warn('"columns" array not found in ngTabled scope!');
  }

  // Check for rows
  if ( !($scope.rows instanceof Array) ) {
    $log.warn('"rows" array not found in ngTabled scope!'); 
  }

  // Object that holds search terms
  $scope.searchTerms = {};

  // Array and Object for sort order+direction
  $scope.sortOrder = [];
  $scope.sortDirection = {};

}])

.directive('ngTabled', function () {
  return {
    // templateUrl: 'views/ng-tabled.html',
    template:  '<table class="{{classes}}">' +
                  '<thead>' +
                    '<tr>' +
                      '<th scope="col" ng-repeat="column in columns" ng-click="toggleSort($event,column)" class="{{ column.sort ? \'sortable-column\' : \'\'}}">' +
                        '{{column.label || column.id}}' +
                        '<span ng-if="column.sort" class="sorting-icon {{ getSortClass( sortDirection[column.id] ) }}"></span>' +
                        '<div class="column-resizer"></div>' +
                      '</th>' +
                    '</tr>' +
                    '<tr ng-if="hasFilterFields()">' +
                      '<th ng-repeat="column in columns">' +
                        '<input type="search" ng-if="(column.filter)" ng-model="searchTerms[column.id]">' +
                      '</th>' +
                    '</tr>' +
                  '</thead>' +
                  '<tbody>' +
                    '<tr ng-repeat="row in rows | tabledRowFilter:columns:searchTerms | tabledRowSorter:columns:sortOrder:sortDirection ">' +
                      '<td ng-repeat="column in columns" >' +
                        '{{ row | tabledCellFilter:column }}' +
                      '</td>' +
                    '</tr>' +
                  '</tbody>' +
                '</table>',
    restrict: 'E',

    scope: {
      columns: '=',
      rows: '=',
      classes: '@class'
    },
    controller: 'TabledController'
  };
});
