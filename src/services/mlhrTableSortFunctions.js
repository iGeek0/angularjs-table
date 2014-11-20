/*
* Copyright (c) 2013 DataTorrent, Inc. ALL Rights Reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
'use strict';

angular.module('datatorrent.mlhrTable.services.mlhrTableSortFunctions',[])

.service('mlhrTableSortFunctions', function() {
  return {
    number: function(field){
      return function(row1,row2) {
        return row1[field]*1 - row2[field]*1;
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
});