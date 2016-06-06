;(function() {

    "use strict";

    var root = this;
    var Farahey;
    if (typeof exports !== 'undefined') {
        Farahey = exports;
    } else {
        Farahey = root.Farahey = {};
    }

    var findInsertionPoint = function(sortedArr, val, comparator) {
            var low = 0, high = sortedArr.length;
            var mid = -1, c = 0;
            while(low < high)   {
                mid = parseInt((low + high)/2);
                c = comparator(sortedArr[mid], val);
                if(c < 0)   {
                    low = mid + 1;
                }else if(c > 0) {
                    high = mid;
                }else {
                    return mid;
                }
            }
            return low;
        },
        geomSupport = typeof jsPlumbGeom !== "undefined" ? jsPlumbGeom : Biltong,
        insertSorted = function(array, value, comparator) {
            var ip = findInsertionPoint(array, value, comparator);
            array.splice(ip, 0, value);
        },
        distanceFromOriginComparator = function(r1, r2, origin) {
            var d1 = geomSupport.lineLength(origin, [ r1.x + (r1.w / 2), r1.y + (r1.h / 2)]),
                d2 = geomSupport.lineLength(origin, [ r2.x + (r2.w / 2), r2.y + (r2.h / 2)]);

            return d1 < d2 ? -1 : d1 == d2 ? 0 : 1;
        },
        EntryComparator = function(origin, getSize) {
            var _origin = origin,
                _cache = {},
                _get = function(entry) {
                    if (!_cache[entry[1]]) {
                        var s = getSize(entry[2]);
                        _cache[entry[1]] = {
                            l:entry[0][0],
                            t:entry[0][1],
                            w:s[0],
                            h:s[1],
                            center:[entry[0][0] + (s[0] / 2), entry[0][1] + (s[1] / 2) ]
                        };
                    }
                    return _cache[entry[1]];
                };

            this.setOrigin = function(o) {
                _origin = o;
                _cache = {};
            };
            this.compare = function(e1, e2) {
                var d1 = geomSupport.lineLength(_origin, _get(e1).center),
                    d2 = geomSupport.lineLength(_origin, _get(e2).center);

                return d1 < d2 ? -1 : d1 == d2 ? 0 : 1;
            };
        };

    var _isOnEdge = function(r, axis, dim, v) { return (r[axis] <= v && v <= r[axis] + r[dim]); },
        _xAdj = [ function(r1, r2) { return r1.x + r1.w - r2.x; }, function(r1, r2) { return r1.x - (r2.x + r2.w); } ],
        _yAdj = [ function(r1, r2) { return r1.y + r1.h - r2.y; }, function(r1, r2) { return r1.y - (r2.y + r2.h); } ],
        _adj = [ null, [ _xAdj[0], _yAdj[1] ], [ _xAdj[0], _yAdj[0] ], [ _xAdj[1], _yAdj[0] ], [ _xAdj[1], _yAdj[1] ] ],
        _genAdj = function(r1, r2, m, b, s) {
            if (isNaN(m)) m = 0;
            var y = r2.y + r2.h,
                x = (m == Infinity || m == -Infinity) ? r2.x + (r2.w / 2) :  (y - b) / m,
                theta = Math.atan(m),
                rise, hyp, run;

            if (_isOnEdge(r2, "x", "w", x)) {
                rise = _adj[s][1](r1, r2);
                hyp = rise / Math.sin(theta);
                run = hyp * Math.cos(theta);
                return { left:run, top:rise };
            }
            else {
                run = _adj[s][0](r1, r2);
                hyp = run / Math.cos(theta);
                rise = hyp * Math.sin(theta);
                return { left:run, top:rise };
            }
        },
    /*
     * Calculates how far to move r2 from r1 so that it no longer overlaps.
     * if origin is supplied, then it means we want r2 to move along a vector joining r2's center to that point.
     * otherwise we want it to move along a vector joining the two rectangle centers.
     */
        _calculateSpacingAdjustment = Farahey.calculateSpacingAdjustment = function(r1, r2) {
            var c1 = r1.center || [ r1.x + (r1.w / 2), r1.y + (r1.h / 2) ],
                c2 = r2.center || [ r2.x + (r2.w / 2), r2.y + (r2.h / 2) ],
                m = geomSupport.gradient(c1, c2),
                s = geomSupport.quadrant(c1, c2),
                b = (m == Infinity || m == -Infinity || isNaN(m)) ? 0 : c1[1] - (m * c1[0]);

            return _genAdj(r1, r2, m, b, s);
        },
    // calculate a padded rectangle for the given element with offset & size, and desired padding.
        _paddedRectangle = Farahey.paddedRectangle = function(o, s, p) {
            return { x:o[0] - p[0], y: o[1] - p[1], w:s[0] + (2 * p[0]), h:s[1] + (2 * p[1]) };
        },
        _magnetize = function(positionArray, positions, sizes, padding,
                              constrain, origin, filter,
                              updateOnStep, stepInterval, stepCallback)
        {
            origin = origin || [0,0];
            stepCallback = stepCallback || function() { };

            var focus = _paddedRectangle(origin, [1,1], padding),
                iterations = 100, iteration = 1, uncleanRun = true, adjustBy, constrainedAdjustment,
                _movedElements = {},
                _move = function(id, o, x, y) {
                    _movedElements[id] = true;
                    o[0] += x;
                    o[1] += y;
                },
                step = function() {
                    for (var i = 0; i < positionArray.length; i++) {
                        var o1 = positions[positionArray[i][1]],
                            oid = positionArray[i][1],
                            a1 = positionArray[i][2], // angle to node from magnet origin
                            s1 = sizes[positionArray[i][1]],
                        // create a rectangle for first element: this encompasses the element and padding on each
                        //side
                            r1 = _paddedRectangle(o1, s1, padding);

                        if (filter(positionArray[i][1]) && geomSupport.intersects(focus, r1)) {
                            adjustBy = _calculateSpacingAdjustment(focus, r1);
                            constrainedAdjustment = constrain(positionArray[i][1], o1, adjustBy);
                            _move(oid, o1, constrainedAdjustment.left, constrainedAdjustment.top);
                        }

                        // now move others to account for this one, if necessary.
                        // reset rectangle for node
                        r1 = _paddedRectangle(o1, s1, padding);
                        for (var j = 0; j < positionArray.length; j++) {
                            if (i != j) {
                                if (filter(positionArray[j][1])) {
                                    var o2 = positions[positionArray[j][1]],
                                        s2 = sizes[positionArray[j][1]],
                                    // create a rectangle for the second element, again by putting padding of the desired
                                    // amount around the bounds of the element.
                                        r2 = _paddedRectangle(o2, s2, padding);

                                    // if the two rectangles intersect then figure out how much to move the second one by.
                                    if (geomSupport.intersects(r1, r2)) {
                                        // TODO (?), instead of moving neither, the other node should move.
                                        uncleanRun = true;
                                        adjustBy = _calculateSpacingAdjustment(r1, r2);
                                        constrainedAdjustment = constrain(positionArray[j][1], o2, adjustBy);
                                        _move(positionArray[j][1], o2, constrainedAdjustment.left, constrainedAdjustment.top);
                                    }
                                }
                            }
                        }
                    }

                    if (updateOnStep)
                        stepCallback();

                    if (uncleanRun && iteration < iterations) {
                        uncleanRun = false;
                        iteration++;
                        if (updateOnStep) {
                            window.setTimeout(step, stepInterval);
                        }
                        else
                            step();
                    }
                };

            step();
            return _movedElements;
        };

    var _convertElements = function(l) {
        if (l == null) return null;
        else if (Object.prototype.toString.call(l) === "[object Array]") {
            var a = [];
            a.push.apply(a, l);
            return a;
        }
        else {
            var o = [];
            for (var i in l) o.push(l[i]);
        }
        return o;
    };

    /**
     * Applies repulsive magnetism to a set of elements relative to a given point, with a specified
     * amount of padding around the point.
     * @class Magnetizer
     * @constructor
     * @param {Object} params Constructor parameters.
     * @param {Selector|Element} [params.container] Element that contains the elements to magnetize. Only required if you intend to use the `executeAtEvent` method.
     * @param {Function} [params.getContainerPosition] Function that returns the position of the container (as an object of the form `{left:.., top:..}`) when requested. Only required if you intend to use the `executeAtEvent` method.
     * @param {Function} params.getPosition A function that takes an element and returns its position. It does not matter to which element this position is computed as long as you remain consistent with this method, `setPosition` and the `origin` property.
     * @param {Function} params.setPosition A function that takes an element and position, and sets it. See note about offset parent above.
     * @param {Function} params.getSize A function that takes an element and returns its size, in pixels.
     * @param {Number[]} [params.padding] Optional padding for x and y directions. Defaults to 20 pixels in each direction.
     * @param {Function} [params.constrain] Optional function that takes an id and a proposed amount of movement in each axis, and returns the allowed amount of movement in each axis. You can use this to constrain your elements to a grid, for instance, or a path, etc.
     * @param {Number[]} [params.origin] The origin of magnetization, in pixels. Defaults to 0,0. You can also supply this to the `execute` call.
     * @param {Selector|String[]|Element[]} params.elements List, or object hash, of elements on which to operate.
     * @param {Boolean} [params.executeNow=false] Whether or not to execute the routine immediately.
     * @param {Function} [params.filter] Optional function that takes an element id and returns whether or not that element can be moved.
     * @param {Boolean} [params.orderByDistanceFromOrigin=false] Whether or not to sort elements first by distance from origin. Can have better results but takes more time.
     */
    root.Magnetizer = function(params) {
        var getPosition = params.getPosition,
            getSize = params.getSize,
            getId = params.getId,
            setPosition = params.setPosition,
            padding = params.padding ||  [20, 20],
        // expects a { left:.., top:... } object. returns how far it can actually go.
            constrain = params.constrain || function(id, current, delta) { return delta; },
            positionArray = [],
            positions = {},
            sizes = {},
            elements = _convertElements(params.elements || []),
            origin = params.origin || [0,0],
            executeNow = params.executeNow,
            minx, miny, maxx, maxy,
            getOrigin = this.getOrigin = function() { return origin; },
            filter = params.filter || function(_) { return true; },
            orderByDistanceFromOrigin = params.orderByDistanceFromOrigin,
            comparator = new EntryComparator(origin, getSize),
            updateOnStep = params.updateOnStep,
            stepInterval = params.stepInterval || 350,
            originDebugMarker,
            debug = params.debug,
            createOriginDebugger = function() {
                var d = document.createElement("div");
                d.style.position = "absolute";
                d.style.width = "10px";
                d.style.height = "10px";
                d.style.backgroundColor = "red";
                document.body.appendChild(d);
                originDebugMarker = d;
            },
            _addToPositionArray = function(p) {
                if (!orderByDistanceFromOrigin || positionArray.length == 0)
                    positionArray.push(p);
                else {
                    insertSorted(positionArray, p, comparator.compare);
                }
            },
            _updatePositions = function() {
                comparator.setOrigin(origin);
                positionArray = []; positions = {}; sizes = {};
                minx = miny = Infinity;
                maxx = maxy = -Infinity;
                for (var i = 0; i < elements.length; i++) {
                    var p = getPosition(elements[i]),
                        s = getSize(elements[i]),
                        id = getId(elements[i]);

                    positions[id] = [p.left, p.top];
                    _addToPositionArray([ [p.left, p.top], id, elements[i]]);
                    sizes[id] = s;
                    minx = Math.min(minx, p.left);
                    miny = Math.min(miny, p.top);
                    maxx = Math.max(maxx, p.left + s[0]);
                    maxy = Math.max(maxy, p.top + s[1]);
                }
            },
            _run = function() {
                if (elements.length > 1) {
                    var _movedElements = _magnetize(positionArray, positions, sizes, padding, constrain, origin, filter, updateOnStep, stepInterval, _positionElements);
                    _positionElements(_movedElements);
                }
            },
            _positionElements = function(_movedElements) {
                for (var i = 0; i < elements.length; i++) {
                    var id = getId(elements[i]);
                    if (_movedElements[id])
                        setPosition(elements[i], { left:positions[id][0], top:positions[id][1] });
                }
            },
            setOrigin = function(o) {
                if (o != null) {
                    origin = o;
                    comparator.setOrigin(o);
                }
            };

        /**
         * Runs the magnetize routine.
         * @method execute
         * @param {Number[]} [o] Optional origin to use. You may have set this in the constructor and do not wish to supply it, or you may be happy with the default of [0,0].
         */
        this.execute = function(o) {
            setOrigin(o);
            _updatePositions();
            _run();
        };

        /**
         * Computes the center of all the nodes and then uses that as the magnetization origin when it runs the routine.
         * @method executeAtCenter
         */
        this.executeAtCenter = function() {
            _updatePositions();
            setOrigin([
                    (minx + maxx) / 2,
                    (miny + maxy) / 2
            ]);
            _run();
        };

        /**
         * Runs the magnetize routine using the location of the given event as the origin. To use this
         * method you need to have provided a `container`,  and a `getContainerPosition` function to the
         * constructor.
         * @method executeAtEvent
         * @param {Event} e Event to get origin location from.
         */
        this.executeAtEvent = function(e) {
            var c = params.container,
                o = params.getContainerPosition(c),
                x = e.pageX - o.left + c[0].scrollLeft,
                y = e.pageY - o.top + c[0].scrollTop;

            if (debug) {
                originDebugMarker.style.left = e.pageX + "px";
                originDebugMarker.style.top = e.pageY + "px";
            }

            this.execute([x,y]);
        };

        /**
         * Sets the current set of elements on which to operate.
         * @method setElements
         * @param {Object[]|Object} _els List, or object hash, of elements, in whatever format the Magnetizer is setup to use. If you supply an object hash then a list is generated from the hash's values (the keys are ignored).
         */
        this.setElements = function(_els) {
            elements = _convertElements(_els);
        };

        /**
         * Adds the given element to the set of elements on which to operate.
         * @param el {Object} Element to add.
         */
        this.addElement = function(el) {
            elements.push(el);
        };

        /**
         * Removes the given element from the set of elements on which to operate.
         * @param el {Object} Element to remove.
         */
        this.removeElement = function(el) {
            var idx = -1;
            for (var i = 0; i < elements.length; i++) {
                if (elements[i] == el) {
                    idx = i; break;
                }
            }
            if (idx != -1) elements.splice(idx, 1);
        };

        /**
         * Sets the padding to insert between magnetized elements.
         * @param {Number[]} p Array of padding for each axis.
         */
        this.setPadding = function(p) {
            padding = p;
        };

        /**
         * Sets the function used to constrain the movement of some element that the magnetizer wishes to relocate.
         * The function is given an element ID and an array of [x,y] values, where each value indicates the proposed amount
         * of movement in the given axis. The function is expected to return an array of [x,y] that indicates the allowed
         * amount of movement in each axis.
         * @param {Function} c
         */
        this.setConstrain = function(f) {
            constrain = c;
        };

        /**
         * Sets the function used to determine whether or not a given element should be considered during the magnetization process.
         * @param {Function} f Filter function to use. Takes an element ID and returns whether or not that element can be moved.
         */
        this.setFilter = function(f) {
            filter = f;
        };

        if (debug)
            createOriginDebugger();

        if (executeNow) this.execute();

    };
}).call(this);        


;(function() {

    var exports = this;

    Array.prototype.peek = function() { return this.length > 0 ? this[this.length - 1] : null; };
    var ieVersion = typeof navigator !== "undefined" ? /MSIE\s([\d.]+)/.test(navigator.userAgent) ? (new Number(RegExp.$1)) : -1 : -1;
    var oldIE = ieVersion > -1 && ieVersion < 9;

    var CustomTag = function(_rotors, tagName, handlers) {
        var combineAttributes = function(ast, fromParseTree) {
            var out = [];
            for (var i = 0; i < ast.length; i++) {
                var newAstEntry = _extend({}, ast[i]);
                _extend(newAstEntry.atts, fromParseTree.atts);
                out.push(newAstEntry);
            }
            return out;
        }.bind(this);

        this.template = handlers.template;
        this.getFunctionBody = function(parseTree) {
            return _rotors.compile(combineAttributes(_rotors.parse(handlers.template), parseTree), false, true, true);
        }.bind(this);
        this.getFunctionEnd = function() {
            return ";_els.pop();";
        };
        this.rendered = handlers.rendered || function() { };
    };

    var
        /**
         * Iterate through a list of strings and perform on operation on each item that is not empty.
         * @static
         * @param strings
         * @param fn
         * @private
         */
        _eachNotEmpty = function(strings, fn) {
            for (var i = 0; i < strings.length; i++) {
                var t = strings[i];
                if (t == null || t.length == 0) continue;
                else {
                    fn(i, t);
                }
            }
        },
        _extend = function(o1, o2) {
            for (var o in o2) {
                o1[o] = o2[o];
            }
            return o1;
        },
        /**
         * Extract a value from, or set a value into, an Object.
         * @param {Object} inObj Object to extract value from or insert value into
         * @param {String} path Path to the value to extract/insert, in dotted notation. This syntax also supports array indices,
         * such as `foo.bar[3]`.
         * @param {Object} [value] If provided, this method sets the value. Otherwise it extracts the current value.
         * @static
         * @return {Object} Value for the given path, null if not found.
         */
        _data = function(inObj, path, value) {
            if (inObj == null) return null;
            if (path === "$data" || path == null) return inObj;
            var q = inObj, t = q, o = null;
            path.replace(/([^\.])+/g, function(term, lc, pos, str) {
                if (o != null) return;
                var array = term.match(/([^\[0-9]+){1}(\[)([0-9+])/),
                    last = pos + term.length >= str.length,
                    _getArray = function() {
                        return t[array[1]] || (function() {  t[array[1]] = []; return t[array[1]]; })();
                    };

                if (last) {
                    if (array) {
                        var _a = _getArray(), idx = array[3];
                        if (value == null)
                            o = _a[idx];
                        else
                            _a[idx] = value;
                    }
                    else {
                        if (value == null)
                            o = t[term];
                        else
                            t[term] = value;
                    }
                }
                else {
                    // set to current t[term], creating t[term] if necessary.
                    if (array) {
                        var a = _getArray();
                        t = a[array[3]] || (function() { a[array[3]] = {}; return a[array[3]]; })();
                    }
                    else
                        t = t[term] || (function() { t[term] = {}; return t[term]; })();
                }
            });

            return o;
        },

    // template resolver for when running in a browser
        InBrowserTemplateResolver = function(tid) {
            var d = document.getElementById(tid);
            return (d != null) ? d.innerHTML : null;
        },
        _isArray = function(a) { return Object.prototype.toString.call(a) === "[object Array]";},
        _isObject = function(a) { return Object.prototype.toString.call(a) === "[object Object]"; },
        _flatten = function(a) {
            var o = [];
            for (var i = 0; i < a.length; i++) {
                if (_isArray(a[i]))
                    o.push.apply(o, _flatten(a[i]));
                else
                    o[o.length] = a[i];
            }
            return o;
        },
        _map = function(l, fn) {
            var o = [];
            for (var i = 0, j = l.length; i < j; i++)
                o.push(fn(l[i]));
            return _flatten(o);
        },
        _filter = function(l, fn) {
            var o = [];
            for (var i = 0, j = l.length; i < j; i++)
                if (fn(l[i])) o.push(l[i]);
            return o;
        },
        _trim = function(s) {
            if (s == null) return s;
            var str = s.replace(/^\s\s*/, ''),
                ws = /\s/,
                i = str.length;
            while (ws.test(str.charAt(--i)));
            return str.slice(0, i + 1);
        },
    //
    // add an attribute binding, optionally with a predicate that must be true.
    //
        _addBinding = function(bindingId, match, entry, predicate, _rotors) {
            var u = _uuid(), b = { w: match, e: [], u: u };
            _rotors.bindings[u] = b;
            var fnBody = function() {
                return predicate != null ?
                    "try {  if(" + predicate + ") { out = out.replace(this.e[k][0], eval(this.e[k][1])); } else out=''; } catch(__) { out='';}"
                    :
                    "try { out = out.replace(this.e[k][0], eval(this.e[k][1])); } catch(__) { out=out.replace(this.e[k][0], '');}";
            };
            var prefix = function() {
                return predicate != null ?
                    "var out='';try { with($data) { if (" + predicate + ") out = this.w; else return null; }}catch(_){return null;}"
                    :
                    "var out = this.w;"
            };
            b.reapply = new Function("$data", prefix() + "for (var k = 0; k < this.e.length; k++) { with($data) { " + fnBody() + " }} return out;");
            entry.bindings[bindingId] = b;
            match.replace(/\$\{([^\}]*)\}/g, function (term, content, _loc, _whole) {
                b.e.push([term, content]);
            });
        },
        _bindOneAtt = function(id, value, output, predicate, _rotors) {
            output.atts[id] = value;
            _addBinding(id, value, output, predicate, _rotors);
        },
        _parseAtts = function(el, _rotors) {
            var p = _rotors.parseAttributes(el),
                o = { el: _trim(p[0]), atts: {}, bindings: {} };

            function _maybeBindAttribute(_p, predicate) {
// if not an inline if, parse a normal attribute.
                var m = _p.match(/([^=]+)=['"](.*)['"]/);
                if (m == null && predicate == null) {
                    o.atts[_p] = "";
                }
                else if (m == null)
                    _bindOneAtt(_p, "", o, predicate, _rotors);
                else {
                    _bindOneAtt(m[1], m[2], o, predicate, _rotors);
                }
                return m;
            }

            for (var i = 1; i < p.length; i++) {
                var _p = _trim(p[i]);
                if (_p != null && _p.length > 0) {

                    // test if this is an inline IF statement. if so, its content should be run back through the attribute
                    // parser to get its constituent parts.
                    var isInlineIf = _p.match(_rotors.inlineIfRe);
                    if (isInlineIf) {
                        var parts = isInlineIf[2].split(_rotors.attributesRe);
                        //var parts = isInlineIf[2].split(/([a-zA-Z\-_]+=['\"][^'^\"]*['\"])/);
                        // add each part one by one using the code below but with the predicate attached.
                        for (var j = 0; j < parts.length; j++) {
                            var __p = _trim(parts[j]);
                            if (__p != null && __p.length > 0) {
                                _maybeBindAttribute(__p, isInlineIf[1]); // bind the attribute with the given predicate.
                            }
                        }
                    }
                    else {
                        _maybeBindAttribute(_p);
                    }
                }
            }
            return o;
        },
        _uuid = function(fullLength) {
            var str = fullLength ? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' : 'xxxxxxxx-xxxx-4xxx';
            return (str.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            }));
        },
        _bind = function(fromObj, id) {
            var b = this.bindings[id];
            if (b == null) return "";
            else {
                return b.reapply(fromObj);
            }
        },
        AbstractEntry = function(params, _rotors) {
            this.uuid = _uuid();
            this.children = [];
            this.context = params.context;
            this.instance = _rotors;
            _rotors.entries[this.uuid] = this;
        },
        ElementEntry = function(data, _rotors) {
            AbstractEntry.apply(this, arguments);
            var ta = _parseAtts(data, _rotors);
            var p = ta.el.split(":");
            this.tag = ta.el;
            if (p.length == 2) this.namespace = p[0];
            this.atts = ta.atts;
            this.bindings = ta.bindings;
            this.type = "element";
            this.compile = function(_rotors, isCustomScope) {

                if (_rotors.customTags[this.tag]) {
                    var fb = _rotors.customTags[this.tag].getFunctionBody(this);
                    for (var c = 0 ; c < this.children.length; c++) {
                        if (this.children[c].precompile) fb += this.children[c].precompile(_rotors);
                        fb += this.children[c].compile(_rotors);
                        if (this.children[c].postcompile) fb += this.children[c].postcompile(_rotors);
                    }
                    fb += "_le=_els.pop();_rotors.customTags['" + this.tag + "'].rendered(_le, _rotors);";
                    return fb;
                }

                var fp = "/* element entry " + this.uuid + " */;";
                // custom elements may set `remove` to true, meaning they behave as an element but their element should not appear in the output.
                if (this.remove !== true) {

                    fp += _rotors.getExecutionContent(this.tag, this.uuid, false, this.namespace);

                    for (var a in this.atts) {
                        if (this.atts.hasOwnProperty(a)) {
                            var attExpr;
                            if (this.bindings[a] != null) {
                                // data bound.
                                attExpr = "_rotors.bind(data[0], '" + this.bindings[a].u + "');";
                            }
                            else {
                                // a static attribute value.
                                attExpr = "'" + this.atts[a] + "'";
                            }
                            fp += "__a=" + attExpr + ";if(__a!=null) e.setAttribute('" + a + "',__a || '');";
                        }
                    }
                }

                for (var i = 0 ; i < this.children.length; i++) {
                    if (this.children[i].precompile) fp += this.children[i].precompile(_rotors);
                    fp += this.children[i].compile(_rotors);
                    if (this.children[i].postcompile) fp += this.children[i].postcompile(_rotors);
                }

                // see note above.
                if (this.remove !== true && !isCustomScope) {
                    fp += "_le=_els.pop();";
                }

                return fp;
            };

            var _applyStyles = function(el, styles) {
                _rotors.each(styles.split(";"),  function(s) {
                    var ss = s.indexOf(":"),
                        prop = s.substring(0, ss);

                    el.style[prop] = s.substring(ss + 1);
                })
            };

            this.update = function(el, data) {
                for (var a in this.atts) {
                    // don't overwrite the class attribute ever. other parts of the UI - outside of Rotors - might
                    // be using it. If you need to style elements based on attributes written by the templates you
                    // can do so without needing to use `class`.
                    if (this.atts.hasOwnProperty(a) && a !== "class") {
                        var attExpr;
                        if (this.bindings[a] != null) {
                            attExpr = this.bindings[a].reapply(data);
                        }
                        else {
                            // a static attribute value.
                            attExpr = "'" + this.atts[a] + "'";
                        }

                        if (attExpr != null) {
                            // special handling for `style` property. write values to the element's `style` instead;
                            // writing to the style attribute blats everything that is already there. One example of
                            // something that breaks is absolute positioning setup by a drag manager.
                            if (a === "style" && el.style != null)
                                _applyStyles(el, attExpr)
                            else
                                el.setAttribute(a, attExpr);
                        }
                    }
                }
            };
        },
        CommentEntry = function(c) {
            this.uuid = _uuid();
            this.comment = c;
            this.compile = function() { return ""; };
        },
        TextEntry = function(params, _rotors) {
            AbstractEntry.apply(this, arguments);
            this.value = params.value;
            this.type = "text";
            this.bindings = {};
            var _getBoundValue = function() {
                return "_rotors.bind(data[0], '" + this.bindings["__element"].u + "', typeof $key !== 'undefined' ? $key : null, typeof $value !== 'undefined' ? $value : null)";
            }.bind(this);
            this.compile = function(_rotors) {
                return _rotors.getExecutionContent(_getBoundValue(), this.uuid, true);
            };
            this.update = function(el, data) {
                el.nodeValue = this.bindings["__element"].reapply(data);
            };
        },
    //
    // a fake document fragment, for those times that Rotors is getting isomorphic.
    //
        Fakement = function() {
            this.childNodes = [];
            this.appendChild = function(n) {
                this.childNodes.push(n);
            };
        },
        FakeElement = function(tag) {
            Fakement.apply(this);
            this.tag = tag;
            var atts = {};
            this.setAttribute = function(name, value) { atts[name] = value; };
            this.getAttribute = function(name) { return atts[name]; };
        },
        FakeTextNode = function(value) {
            this.nodeValue = value;
        },
        _getDefaultTemplateResolver = function(_rotors) {
            return _rotors.isBrowser ? InBrowserTemplateResolver : null;
        },
        _wrapCache = function(_rotors, resolver, forceReload) {
            return function(id) {
                var t = forceReload ? null : _rotors.cache[id];
                if (t == null) {
                    t = resolver(id);
                }
                if (t == null) {
                    t = _rotors.defaultTemplate;
                }
                if (t != null) {
                    _rotors.cache[id] = t;
                }
                return t;
            };
        };

    var RotorsInstance = function(params) {
        params = params || {};
        this.cache = {};
        this.templateCache = {};
        if (params.defaultTemplate != null)
            this.setDefaultTemplate(params.defaultTemplate);

        this.map = function(id) { alert(id); }
    };
    var _e = function(a, b) {
        for (var i in b) {
            if (b.hasOwnProperty(i)) a[i] = b[i];
        }
    };
    _e(RotorsInstance.prototype, {
        bindings:{},
        entries:{},
        executions:{},
        bind:_bind,
        defaultTemplate:"<div></div>",
        defaultCompiledTemplate:null,
        setDefaultTemplate:function(str) {
            if (str != null) {
                this.defaultTemplate = str;
                this.defaultCompiledTemplate = this.compile(this.parse(str));
            }
            else {
                this.clearDefaultTemplate();
            }
        },
        clearDefaultTemplate:function() {
            this.defaultTemplate = null;
            this.defaultCompiledTemplate = null;
        },
        /**
         * Clears the template cache for this instance of Rotors.
         * @method clearCache
         */
        clearCache:function() { this.cache = {}; this.templateCache = {}; },
        namespaceHandlers : {
            "svg":function(tag) {
                return "e = document.createElementNS('http://www.w3.org/2000/svg', '" + tag.split(":")[1] + "');" +
                    "e.setAttribute('version', '1.1');" +
                    "e.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');";
            }
        },
        each:function(l, fn, loopUuid, ctx) {
            var i;
            if (_isArray(l)) {
                for (i = 0; i < l.length; i++) {
                    fn(l[i], loopUuid, i, ctx);
                }
            }
            else {
                for (i in l) {
                    if (l.hasOwnProperty(i)) {
                        fn({"$key":i, "$value":l[i]}, loopUuid, i, ctx);
                    }
                }
            }
        },
        openRe : new RegExp("<([^\/>]*?)>$|<([^\/].*[^\/])>$"),
        closeRe : new RegExp("^<\/([^>]+)>"),
        openCloseRe : new RegExp("<(.*)(\/>$)"),
        tokenizerRe:/(<[^\^>]+\/>)|(<!--[\s\S]*?-->)|(<[\/a-zA-Z0-9\-:]+(?:\s*[a-zA-Z\-]+=\"[^\"]+\"|\s*[a-zA-Z\-]+='[^']+'|\s*[a-zA-Z\-]|\s*\{\{.*\}\})*>)/,
        commentRe: /<!--[\s\S]*?-->/,
        attributesRe:/([a-zA-Z0-9\-_:]+="[^"]*")|(\{\{if [^(?:\}\})]+\}\}.*\{\{\/if\}\})/,
        inlineIfRe:/\{\{if ([^\}]+)\}\}(.*)\{\{\/if\}\}/,
        singleExpressionRe : /^[\s]*\$\{([^\}]*)\}[\s]*$/,          // match an expression such as ${foo} or ${x/2}
        parseAttributes : function(d) {
            return d == null ? d : this.filterEmpty(d.replace("/>", ">").split(/^<|>$/)[1].split(this.attributesRe));
        },
        map:_map,
        flatten:_flatten,
        filter:_filter,
        data:_data,
        camelize:function(p) {
            return p;
        },
        dataExperiment:function(inObj, path, value) {
            if (inObj == null) return null;
            if (path === "$data" || path == null) return inObj;
            var h;
            with(inObj) {
                if (value != null) {
                    var v = typeof value === "string" ? "\"" + value + "\"" : value;
                    eval(path + "=" + v );
                }
                else
                    eval("h=" + path);
            }
            return h;
        },
        uuid:_uuid,
        filterEmpty:function(l) {
            return _filter(l, function(i) { return i != null && _trim(i).length > 0; });
        },
        // exposed for override when testing.
        isBrowser:(function() { return typeof document !== "undefined"; })(),
        // exposed for override when testing.
        isOldIE : function() { return oldIE; },
        createFragment:function() {
            return this.isBrowser ? this.isOldIE() ? document.createElement("div") : document.createDocumentFragment() : new Fakement();
        },
        createTextNode:function(value) {
            return this.isBrowser ? document.createTextNode(value) : new FakeTextNode(value);
        },
        createElement:function(tag) {
            return this.isBrowser ? document.createElement(tag) : new FakeElement(tag);
        },
        customElements:{
            "r-each":{
                parse:function(entry, match, templateResolver, _rotors) {
                    entry.context = entry.atts["in"];
                    entry.type = "each";
                },
                compile:function(_rotors) {
                    var _getChildContent = function() {
                        var out = "function(item, _rotorsLoopId, _rotorsLoopIndex, _rotorsLoopContext) { ";
                        out += "data.unshift(item);$value=item;$key=_rotorsLoopIndex;";
                        for (var i = 0; i < this.children.length; i++) {
                            out += this.children[i].compile(_rotors);
                            out += ";_rotors.popExecutionTrace(_eid, '" + this.uuid + "');"
                        }
                        out += "data.splice(0,1);";
                        out += "}";
                        return out;
                    }.bind(this);
                    var l1 = "_rotors.traceExecution(null, _eid, '" + this.uuid + "');";
                    var l2 = this.context ? ";data.unshift(_rotors.data(data[0], \"" + this.context + "\"));" : "";
                    var l3 = "_rotors.each(data[0], " + _getChildContent() + ",'"  + this.uuid + "', '" + this.context + "');";
                    var l4 = this.context ? ";data.splice(0, 1);" : "";
                    return l1 + l2 + l3 + l4;
                }
            },
            "r-if":{
                parse:function(entry, match, templateResolver, _rotors) {
                    entry.test = entry.atts["test"];
                },
                compile:function(_rotors) {
                    var c = "", _else = "", i;
                    var happyFlow = this.happyFlowChildren || this.children;
                    for (i = 0; i < happyFlow.length; i++) {
                        c += happyFlow[i].compile(_rotors) + ";";
                    }
                    if (this.happyFlowChildren != null) {
                        // if happy flow was set, then `children` is unhappy flow.
                        _else = "else {";
                        for (i = 0; i < this.children.length; i++) {
                            _else += this.children[i].compile(_rotors) + ";";
                        }
                        _else += "}";
                    }
                    return ";with (data[0]) { if(" + this.test + ") { " + c + " }" + _else + "}";
                }
            },
            "r-else":{
                remove:true,
                parse:function(entry, match, templateResolver, _rotors, stack) {
                    var ifStatement = stack.peek();
                    if (ifStatement == null || ifStatement.tag !== "r-if") return;
                    else {
                        ifStatement.happyFlowChildren = ifStatement.children;
                        ifStatement.children = [];
                    }
                },
                compile:function(_rotors) { }
            },
            "r-for":{
                parse:function(entry, match, templateResolver, _rotors, stack) {
                    entry.loop = entry.atts["loop"];
                },
                compile:function(_rotors) {
                    var out = "";
                    out += "var __limit; with(data[0]){__limit=(" + this.loop + ");}";
                    out += "for(var $index=0;$index<__limit;$index++){data[0].$index=$index;";
                    for (var i = 0; i < this.children.length; i++) {
                        out += this.children[i].compile(_rotors) + ";";
                    }
                    out += "}delete data[0].$index;";
                    return out;

                }
            },
            "r-tmpl":{
                remove:true,
                parse:function(entry, match, templateResolver, _rotors) {
                    entry.type = "template";
                    entry.context = entry.atts["context"];
                    entry.templateId = entry.atts["id"];
                    var _nested = templateResolver(entry.templateId);
                    var nestedAst = _rotors.parse(_nested, templateResolver);
                    _rotors.debug("nested ast", nestedAst);
                    entry.children = nestedAst;
                },
                precompile:function(_rotors) {
                    return this.context ? ";data.unshift(_rotors.data(data[0], \"" + this.context + "\"));" : "";
                },
                postcompile:function(_rotors) {
                    return this.context ? ";data.splice(0, 1);" : "";
                }
            },
            "r-html":{
                parse:function(entry, match, templateResolver, _rotors) { },
                compile:function(_rotors) {
                    return ";var __hp=_rotors.parse(data[0].value),__hc=_rotors.compile(__hp,true);var __f=__hc(data[0], _rotors);_els.peek().appendChild(__f.childNodes[0]);";
                }
            }
        },
        customTags:{ },
        registerTag:function(tagName, handlers) {
            this.customTags[tagName] = new CustomTag(this, tagName, handlers);
        },
        debugEnabled:false,
        debug:function() {
            if (this.debugEnabled) console.log.apply(console, arguments);
        },
        maybeDebug:function() {
            if (this.debugEnabled && arguments[0])
                console.log.apply(console, arguments);
        },
        parse:function(str, templateResolver) {
            templateResolver = _wrapCache(this, templateResolver || _getDefaultTemplateResolver(this), null);
            var stack = [],
                results = [],
                _rotors = this,
                _test = function(token, re) {
                    var m = token.match(re);
                    return (m == null) ? false : m;
                },
                _peek = function() {
                    return stack.length > 0 ? stack[stack.length - 1] : null;
                },
                _isBalanced = function(endTag) {
                    var p = _peek();
                    return p != null && p.tag == endTag;
                },
                _push = function(el, doNotSetCurrent) {
                    if (stack.length > 0) _peek().children.push(el);
                    if (!doNotSetCurrent)
                        stack.push(el); // push to stack, unless told not to
                    else if (stack.length == 0)
                        results.push(el); // if not pushing to stack and the stack is empty, must push to results or we'll lose this one.
                },
                _pushChild = function(el) {
                    _push(el, true);
                },
                _pop = function() {
                    var r = stack.pop();
                    if (stack.length == 0) results.push(r);
                    return r;
                },
                _openElementHandler = function(t, m, templateResolver, _rotors) {
                    var ee = new ElementEntry(t, _rotors), custom = _rotors.customElements[ee.tag];
                    if (custom) {
                        custom.parse(ee, m, templateResolver, _rotors, stack);
                        if (custom.compile) ee.compile = custom.compile;
                        ee.precompile = custom.precompile;
                        ee.postcompile = custom.postcompile;
                        ee.custom = true;
                        ee.remove = custom.remove;
                        _rotors.debug("  element is a custom element");
                        _rotors.maybeDebug(ee.remove, "  element's root should not appear in output");
                    }
                    return ee;
                },
                tagHandlers = [
                    {
                        re:_rotors.commentRe,
                        handler:function(t, m, templateResolver, _rotors) {
                            _rotors.debug("comment", t, m);
                            _push(new CommentEntry(t), true);
                        }
                    },
                    {
                        re:_rotors.openRe,
                        handler:function(t, m, templateResolver, _rotors) {
                            _rotors.debug("open element", t, m);
                            var ee = _openElementHandler(t, m, templateResolver, _rotors);
                            _push(ee, ee.remove);
                        }
                    },
                    {
                        re:_rotors.closeRe,
                        handler:function(t, m, templateResolver, _rotors) {
                            _rotors.debug("close element", t, m);
                            var custom = _rotors.customElements[m[1]];
                            if (custom != null && custom.remove) return;
                            if (!_isBalanced(m[1])) {
                                throw new TypeError("Unbalanced closing tag '" + m[1] + "'; opening tag was '" + _pop().tag + "'");
                            }

                            else _pop();
                        }
                    },
                    {
                        re:_rotors.openCloseRe,
                        handler:function(t, m, templateResolver, _rotors) {
                            _rotors.debug("open and close element", t, m);
                            var ee = _openElementHandler(t, m, templateResolver, _rotors);
                            _push(ee, true);
                        }
                    },
                    {
                        re:/.*/,
                        handler:function(t, m, templateResolver, _rotors) {
                            var val = _trim(t);
                            if (val != null && val.length > 0) {
                                _rotors.debug("text node", t);
                                var te = new TextEntry({ value: val }, _rotors);
                                _pushChild(te);
                                _addBinding("__element", val, te, null, _rotors);
                            }
                        }
                    }
                ];

            _eachNotEmpty(_trim(str).split(this.tokenizerRe), function(index, item) {
                for (var j = 0; j < tagHandlers.length; j++) {
                    item = _trim(item);
                    var m = _test(item, tagHandlers[j].re);
                    if (m) {
                        tagHandlers[j].handler(item, m, templateResolver, this);
                        break;
                    }
                }
            }.bind(this));

            //if (results.length == 0)
            //  what to do? malformed, seemingly.

            return results;
        },
        /**
         * Generates a template Function from the given AST. The function returns a DocumentFragment when running in a browser,
         * and a Fakement - a DocumentFragment-like object - when not.  The AST you pass in to this method is returned from
         * a call to `Rotors.parse(string)`.
         */
        compile:function(ast, precompileOnly, functionBodyOnly, isCustomScope) {
            // create data stack, fragment (which in browser is a DocumentFragment and on the server a Fakement, a stack
            // for the current parent element, and a execution id, which is a globally unique id that will be in scope for
            // every function executed in this template, and can subsequently be used to retrieve all of the elements associated
            // with a particular execution of this template function,

            var fp = "data=[data||{}];var frag=_rotors.createFragment(),_els=[],e,_le,__a,$value,$key,_eid = _rotors.newExecutionContext();_els.push(frag);",
                fs = "return frag;",
                items = [];

            for (var i = 0; i < ast.length; i++) {
                // here we pass in the currently-static Rotors member. But in the future this will be the current instance.
                var content = "";
                if (ast[i].precompile) content += ast[i].precompile(this);
                content += ast[i].compile(this, isCustomScope);
                if (ast[i].postcompile) content += ast[i].postcompile(this);
                items.push(content);
            }

            var fb = items.join("");
            this.debug("function body :", fb);
            if (functionBodyOnly)
                return fb;

            //fb = fp + fb;

            var f = new Function("data,_rotors", fp + items.join("") + fs), _r = this;
            if (!precompileOnly) {
                return function (data) {
                    return f.apply(this, [data, _r]);
                };
            }
            else {
                return f;
            }
        },
        newExecutionContext:function() {
            var _eid = this.uuid();
            this.executions[_eid]={current:{children:[]}};
            return _eid;
        },
        traceExecution:function(el, eid, entryId, loopIndex) {
            var __ec={el:el, children:[], id:entryId, index:loopIndex};
            this.executions[eid].current.children.push(__ec);
            var key = entryId + (loopIndex != null ? "-" + loopIndex : "");
            this.executions[eid][key]=__ec;
            this.executions[eid].current=__ec;
        },
        popExecutionTrace:function(eid, current) {
            this.executions[eid].current = this.executions[eid][current];
        },
        getExecutionContent:function(content, uuid, isTextNode, namespace, _rotors) {
            var p = namespace != null ? this.namespaceHandlers[namespace](content) : (isTextNode ? "e=_rotors.createTextNode(" + content + ");" : "e=_rotors.createElement('" + content + "');");
            return p + "_els.peek().appendChild(e);" +
                (isTextNode ? "" : "_els.push(e);") +
                "e._rotors=_rotors.entries['" + uuid + "'];" +
                "e._rotorsEid=_eid;" +
                "if(typeof _rotorsLoopId !== 'undefined') {e._rotorsLoopId=_rotorsLoopId;e._rotorsLoopIndex=_rotorsLoopIndex;e._rotorsLoopContext=_rotorsLoopContext;}" +
                "_rotors.traceExecution(e, _eid, '" + uuid + "', typeof _rotorsLoopIndex != 'undefined' ? _rotorsLoopIndex : null);";
        },
        updaters:{},
        /**
         * Register a callback for when the given element is updated. A uuid is written onto the element and the update
         * entries check for its existence in their reapply methods.
         * @param el
         * @param fn
         */
        onUpdate:function(el, fn) {
            if (el._rotors == null) return;
            var _rotors = el._rotors.instance;
            el._RotorsUpdate = el._RotorsUpdate || _uuid();
            _rotors.updaters[el._RotorsUpdate] = _rotors.updaters[el._RotorsUpdate] || [];
            _rotors.updaters[el._RotorsUpdate].push(fn);
        },
        /**
         * Updates an element with the given data. If the element was not rendered by Rotors, the method exits silently.
         * This method will traverse down into child elements and apply the data given using the same context rules
         * specified in your template.  Alternatively, if you just want to update a single element (say one LI from a UL,
         * for example), then you can supply just that one element, and of course a data object that is appropriate for what
         * context that element expects.
         * @param {Element} el DOM node to update.
         * @param {Object} data Data to update the DOM node with.
         */
        update:function(el, data) {
            var elsToUpdate = [];
            // Get the execution id, that is the ID of the particular invocation of the template function that
            // resulted in this element being created.  If it does not exist - or if, for some reason, the binding data is
            // not on this element, return.
            var eid = el._rotorsEid, executionContext, rootEntry, _rotors;
            if (eid == null || el._rotors == null) return;
            // otherwise, retrieve the context and get the entry for this specific element.
            else {
                _rotors = el._rotors.instance;
                executionContext = _rotors.executions[eid];
                var idx = el._rotorsLoopIndex, key = el._rotors.uuid + (idx != null ? "-" + idx : "");
                rootEntry = executionContext[key];
            }

            var _one = function(el, d, entry) {
                if (el != null) {
                    // update the element itself
                    el._rotors.update(el, d);
                    if (el._RotorsUpdate && _rotors.updaters[el._RotorsUpdate]) {
                        elsToUpdate.push([el, _rotors.updaters[el._RotorsUpdate], d]);
                    }
                }

                // iterate the children
                for (var i = 0; i < entry.children.length; i++) {
                    var childEntry = _rotors.entries[entry.children[i].id],
                        isLoop = _rotors.entries[entry.id].type === "each",
                        cd = (isLoop && entry.children[i].el != null && entry.children[i].el._rotorsLoopIndex != null) ? d[entry.children[i].el._rotorsLoopIndex] : _rotors.data(d, childEntry.context);

                    _one(entry.children[i].el, cd, entry.children[i]);
                }
            };

            _one(el, data, rootEntry);

            for (var i = 0; i < elsToUpdate.length; i++) {
                var entry = elsToUpdate[i];
                for (var j = 0; j < entry[1].length; j++) {
                    try {
                        entry[1][j](entry[0], entry[2]);
                    }
                    catch (e) {
                    }
                }
            }
        },
        /**
         * Renders a template with the given id with the given data. Optionally, you can supply a template resolver
         * to this method. If you do not provide one, Rotors will use the default mechanism for looking up templates,
         * which is, in a browser, to get a DOM node with the given ID and return its innerHTML, and on the server the
         * behaviour is as-yet undefined.
         * @param {String} id ID of the template to compile.
         * @param {Object} [data] Data for the compilation. Optional, but it's pretty certain you'll want to provide this most of the time...
         * @param {Function} [templateResolver] Optional function that takes an ID and returns the content of a template.
         * @returns {DocumentFragment|Fakement|Element} A DocumentFragment when running in a modern browser, or a Fakement - which behaves a lot like a DocumentFragment - when running on the server, or an element when running in IE8 or below. For this reason, if you want to use Rotors with IE8, you must ensure that your templates have a single root node.
         */
        template:function(id, data, templateResolver, forceReload) {
            var r;
            var cachedTemplate = !forceReload ? this.templateCache[id] : null;
            if (cachedTemplate != null) {
                r = cachedTemplate(data);
                return this.isOldIE() ? r.childNodes[0] : r;
            }
            else {
                templateResolver = _wrapCache(this, templateResolver || _getDefaultTemplateResolver(this), forceReload);
                var content = templateResolver(id);
                if (content != null) {
                    var p = this.parse(content, templateResolver),
                        c = this.compile(p);

                    this.templateCache[id] = c;

                    r = c(data);
                    return this.isOldIE() ? r.childNodes[0] : r;
                }
                else {
                    return this.createFragment();
                }
            }
        },
        /**
         * Precompile the given content into a template function, for later import by some Rotors instance.
         * @param {String} content Template content.
         * @param {Function} [templateResolver] Optional resolver to use for templates referenced by this one.
         * @returns {Function} A template function. This function expects two arguments: some data, and a Rotors instance to execute against.
         */
        precompileTemplate:function(content, templateResolver) {
            var p = this.parse(content, templateResolver || _getDefaultTemplateResolver(this));
            return this.compile(p, true);
        },
        /**
         * Precompile the given map of [id->content] pairs into a set of template functions, for later import by some Rotors instance.
         * @param {Object} data id->content pairs for templates to precompile.
         * @param {Function} [templateResolver] Optional resolver to use for templates referenced by this one.
         * @returns {Object} A map of id->functions, one for each precompiled template.
         */
        precompileTemplates:function(data, templateResolver) {
            // create a template resolver that first looks in the data given to this method and then hands
            // off to the underlying resolver if content not found.
            var tr = function(tId) {
                    var t = data[tId];
                    return t || (templateResolver || _getDefaultTemplateResolver(this))(tId);
                },
                out = {};
            for (var id in data) {
                out[id] = this.precompileTemplate(data[id], tr);
            }
            return out;
        },
        /**
         * Import the given template function and store it against the given id.
         * @method importTemplate
         * @param {String} id ID to store for later retrieval of the template
         * @param {Function} fn A template function that was created by the `precompileTemplate` or `precompileTemplates` method of an instance of Rotors.
         */
        importTemplate:function(id, fn) {
            var r = this;
            fn = typeof fn === "string" ? Function("data", "_rotors", fn) : fn;
            this.templateCache[id] = function(d) {
                return fn.apply(r, [d, r]);
            };
        },
        /**
         * Import the given map of [id->template] pairs and store them in the cache.
         * @method importTemplates
         * @param {Object} data A map of [id->function] pairs, each of which will be passed as the arguments to a call to `importTemplate`.
         */
        importTemplates:function(data) {
            for (var id in data) {
                this.importTemplate(id, data[id]);
            }
        },

        importBindings:function(bindings) {
            this.bindings = this.bindings || {};
            for (var b in bindings) {
                var _b = bindings[b];
                this.bindings[b] = {
                    e: _b.e,
                    u: _b.u,
                    w: _b.w,
                    reapply: Function("$data", _b.reapply)
                };
            }
        }
    });

    /* ---------------------------- browser vs server expose --------------------------------------------------------- */

    var newInstance = function (params) {
        return new RotorsInstance(params);
    };

    var exportBindings = function(rotors) {
        var o = {};
        for (var b in rotors.bindings) {
            var _b = rotors.bindings[b];
            o[b] = {
                e:_b.e,
                u:_b.u,
                w:_b.w,
                reapply:String(_b.reapply).replace(/^function\s*\S+\s*\([^)]*\)\s*\{|\}$/g, "")
            };
        }
        return o;
    };

    /**
     * Scans the given input for templates in the form
     * <script type="rotors" id="someId">...</script>
     * and output an array containing a map of template Ids -> template functions as the first argument, plus the
     * input text stripped of templates as the second argument. **NOTE** the `type` attribute must be specified
     * before the `id` attribute.
     * @method precompile
     * @param {String} html HTML to preprocess.
     * @param {String} [type='rotors'] Optional `type` of scripts used as templates. Defaults to "rotors".
     * @returns {Object[]} an array containing a map of template Ids -> template functions as the first argument, plus the
     * input text stripped of templates as the second argument.
     */
    var precompile = function(html, type) {
        type = type || "rotors";
        var rotors = (exports.Rotors || exports).newInstance();
        var filteredInput, foundTemplates = {};
        var regex = new RegExp("\<script type=['\"]" + type + "['\"] id=['\"]([^'\"]+)['\"]>((.*\n)*?)\<\/script\>", "g");
        filteredInput = html.replace(regex, function(_, templateId, templateBody) {
            foundTemplates[templateId] = templateBody ;
            return "";
        });
        var output = [ {}, null, filteredInput ];

        for (var t in foundTemplates) {
            output[0][t] = String(rotors.precompileTemplate(foundTemplates[t], function(id) { return foundTemplates[id]})).replace(/^function\s*\S+\s*\([^)]*\)\s*\{|\}$/g, "") ;
        }

        output[1] = exportBindings(rotors);

        return output;
    };

    /**
     * Gets a new instance of Rotors.
     * @method newInstance
     * @param {Object} [params] Optional set of constructor parameters for the new instance.
     * @returns {RotorsInstance}
     */
    if (typeof document !== "undefined") {
        exports.Rotors = {
            newInstance: newInstance,
            precompile:precompile,
            data:_data
        };
        exports.RotorsInstance = RotorsInstance;
    }
    else {
        exports.newInstance = newInstance;
        exports.instanceClass = RotorsInstance;
        exports.precompile = precompile;
        exports.data = _data;
    }

}).call(this);
/**
 * Utility functions that run only in browsers, and are not included in a headless environment build.
 */
;
(function () {

    var root = this;
    root.jsPlumbToolkitUtil = root.jsPlumbToolkitUtil || { };
    var exports = root.jsPlumbToolkitUtil;

    var __bind = function (fn, me) {
        return function () {
            return fn.apply(me, arguments);
        };
    };

    var requestAnimationFrame = exports.requestAnimationFrame = __bind(root.requestAnimationFrame ||
        root.webkitRequestAnimationFrame ||
        root.mozRequestAnimationFrame ||
        root.oRequestAnimationFrame ||
        root.msRequestAnimationFrame ||
        function (callback, element) {
            root.setTimeout(callback, 10);
        }, root);


    /**
     * Execute an ajax call.
     * @method jsPlumbToolkitUtil.ajax
     * @param {Object} params
     * @param {String} [params.type="get"] HTTP operation.
     * @param {String} [params.dataType] Expected datatype of response.
     * @param {String} params.url URL to connect to.
     * @param {Function} params.success Function to call on success, with received data. Success is deemed to be any status code in the 2XX range.
     * @param {Function} [params.error] Optional function to call on error. Will be given the response text and the status code as arguments.
     * @param {Object} [params.data] Optional data payload.
     * @param {Object} [params.headers] Optional map of HTTP header values.
     */
    exports.ajax = function (params) {
        var req = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
        var verb = params.type || "GET";
        if (req) {
            var responder = params.dataType === "json" ? function (d) {
                return JSON.parse(d);
            } : function (d) {
                return d;
            };
            req.open(verb, params.url, true);
            var headers = params.headers || {};
            for (var h in headers) {
                req.setRequestHeader(h, headers[h]);
            }
            req.onreadystatechange = function () {
                if (req.readyState == 4) {
                    if (("" + req.status)[0] === "2")
                        params.success(responder(req.responseText));
                    else
                        params.error && params.error(req.responseText, req.status);
                }
            };
            req.send(params.data ? JSON.stringify(params.data) : null);
        }
        else
            params.error && params.error("ajax not supported");
    };

    /**
     * Generates a debounce helper for the given function, with the given timeout. The given function will be called only
     * when a period of length `timeout` has elapsed since the last call to the debounce function. Use this for stuff like
     * relayout of your UI when the window is resized, or firing an ajax call after a series of checkboxes have been
     * selected or deselected.
     * @method jsPlumbToolkitUtil.debounce
     * @param {Function} fn Function to fire
     * @param {Number} [timeout=150] Timeout, in milliseconds. Default is 150.
     * @returns {Function} a function with debouncing built in.
     */
    exports.debounce = function(fn, timeout) {
        timeout = timeout || 150;
        var _t = null;
        return function() {
            window.clearTimeout(_t);
            _t = window.setTimeout(fn, timeout);
        };
    };

    exports.xml = {
        /**
         * Sets a node's text value.
         * @method jsPlumbToolkitUtil.xml.setNodeText
         * @param {Element} node Element to set text on.
         * @param {String} text Text to set.
         */
        setNodeText: function (node, text) {
            node.text = text;  // IE
            try {
                node.textContent = text;
            }
            catch (e) {
            }
        },
        /**
         * Gets text from the given node.
         * @method jsPlumbToolkitUtil.xml.getNodeText
         * @param {Element} node XML element.
         */
        getNodeText: function (node) {
            return node != null ? node.text || node.textContent : "";
        },
        /**
         * Gets the first instance of the child with the given tag name, null if none found.
         * @method jsPlumbToolkitUtil.xml.getChild
         * @param {Element} parent Element to retrieve child from.
         * @param {String} name Child tag name to retrieve.
         */
        getChild: function (parent, name) {
            var c = null;
            for (var i = 0; i < parent.childNodes.length; i++) {
                if (parent.childNodes[i].nodeType == 1 && parent.childNodes[i].nodeName == name) {
                    c = parent.childNodes[i];
                    break;
                }
            }
            return c;
        },
        /**
         * Gets children of the given node (only direct children), returning an array of nodes (an empty array if none found).
         * @method jsPlumbToolkitUtil.xml.getChildren
         * @param {Element} parent Element to retrieve children from.
         * @param {String} name Child tag names to retrieve.
         */
        getChildren: function (parent, name) {
            var c = [];
            for (var i = 0; i < parent.childNodes.length; i++) {
                if (parent.childNodes[i].nodeType == 1 && parent.childNodes[i].nodeName == name) {
                    c.push(parent.childNodes[i]);
                }
            }
            return c;
        },
        /**
         * Serializes the given XML node to a string, throwing an Error if something goes bad.
         * @method jsPlumbToolkitUtil.xml.xmlToString
         * @param {Element} xmlNode XML element to serialize.
         * @return {String} Serialized XML element.
         */
        xmlToString: function (xmlNode) {
            try {
                // Gecko-based browsers, Safari, Opera.
                return (new XMLSerializer()).serializeToString(xmlNode).replace(/\s*xmlns=\"http\:\/\/www.w3.org\/1999\/xhtml\"/g, "");
            }
            catch (e) {
                try {
                    // Internet Explorer.
                    return xmlNode.xml;
                }
                catch (ee) {
                    throw new Error("Cannot serialize XML " + ee);
                }
            }
            return false;
        },
        /**
         * Creates an XML element.
         * @method jsPlumbToolkitUtil.xml.createElement
         * @param {String} name Tag name of the element to create.
         * @param {Object} [attributes] Optional map of attribute names and values.
         * @param {String} [text] Optional text for the element.
         * @return {Element} An XML element.
         */
        createElement: function (name, attributes, text) {
            var n;
            //http://www.devguru.com/technologies/xmldom/quickref/document_createnode.html
            try {
                n = new ActiveXObject("Microsoft.XMLDOM").createNode(1, name, "");
            }
            catch (e) {
                n = document.createElement(name);
            }

            if (text) jsPlumbToolkitUtil.xml.setNodeText(n, text);
            if (attributes) {
                for (var i in attributes)
                    n.setAttribute(i, attributes[i]);
            }

            return n;
        }
    };

}).call(this);

/**
 *
 * jsPlumbToolkit utility functions, used both in browser and on server.
 *
 * Dependencies
 *
 * jsPlumbUtil (does this depend on browser at all? it shouldnt.)
 */

;
(function () {

    "use strict";

    var root = this;
    root.jsPlumbToolkitUtil = root.jsPlumbToolkitUtil || { };
    var exports = root.jsPlumbToolkitUtil;
    var JUTIL = root.jsPlumbUtil;

    exports.fastTrim = function (s) {
        var str = s.replace(/^\s\s*/, ''),
            ws = /\s/,
            i = str.length;
        while (ws.test(str.charAt(--i)));
        return str.slice(0, i + 1);
    };

    exports.uuid = function () {
        return ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }));
    };

    exports.each = function(obj, fn) {
        obj = obj.length == null || typeof obj === "string" ? [ obj ] : obj;
        for (var i = 0; i < obj.length; i++) {
            fn(obj[i]);
        }
    };

    // take the given model and expand out any parameters.
    exports.populate = function (model, values) {
        // for a string, see if it has parameter matches, and if so, try to make the substitutions.
        var getValue = function (fromString) {
                var matches = fromString.match(/(\${.*?})/g);
                if (matches != null) {
                    for (var i = 0; i < matches.length; i++) {
                        var val = values[matches[i].substring(2, matches[i].length - 1)];
                        if (val) {
                            fromString = fromString.replace(matches[i], val);
                        }
                    }
                }
                return fromString;
            },
        // process one entry.
            _one = function (d) {
                if (d != null) {
                    if (JUTIL.isString(d)) {
                        return getValue(d);
                    }
                    else if (JUTIL.isArray(d)) {
                        var r = [];
                        for (var i = 0; i < d.length; i++)
                            r.push(_one(d[i]));
                        return r;
                    }
                    else if (JUTIL.isObject(d)) {
                        var r = {};
                        for (var i in d) {
                            r[i] = _one(d[i]);
                        }
                        return r;
                    }
                    else {
                        return d;
                    }
                }
            };

        return _one(model);
    };

    exports.mergeWithParents = function (type, map, parentAttribute) {

        parentAttribute = parentAttribute || "parent";
        var _def = function (id) {
            return id ? map[id] : null;
        };
        var _parent = function (def) {
            return def ? _def(def[parentAttribute]) : null;
        };

        var _one = function (parent, def) {
            if (parent == null) return def;
            else {
                var d = jsPlumbUtil.merge(parent, def);
                return _one(_parent(parent), d);
            }
        };

        var _getDef = function (t) {
            if (t == null) return {};
            if (typeof t == "string") return _def(t);
            else if (t.length) {
                var done = false, i = 0, _dd;
                while (!done && i < t.length) {
                    _dd = _getDef(t[i]);
                    if (_dd) {
                        done = true;
                    }
                    else
                        i++;
                }
                return _dd;
            }
        };

        var d = _getDef(type);
        if (d)
            return _one(_parent(d), d);
        else
            return {};
    };

}).call(this);

/*
 * anim
 *
 * Copyright 2015 jsPlumb
 * http://jsplumbtoolkit.com
 *
 * This software is not free.
 *
 * This file contains code for working with animations.
 *
 * Namespace: jsPlumbToolkit
 *
 * Dependencies:
 *
 * jsPlumbToolkit
 * jsPlumbUtil
 */
;(function() {

    var events = {
        nodeTraverseStart:"startNodeTraversal",
        nodeTraverseEnd:"endNodeTraversal",
        start:"startOverlayAnimation",
        end:"endOverlayAnimation"
    };

    var classes = {
        nodeTraversing:"jtk-animate-node-traversing",
        edgeTraversing:"jtk-animate-edge-traversing",
        nodeTraversable:"jtk-animate-node-traversable",
        edgeTraversable:"jtk-animate-edge-traversable"
    };

    /**
     * Traces the given overlay along the Connection.
     * @param {String|Object} overlaySpec This is in the format accepted by the Community edition of jsPlumb.
     * @param {Object} [options] for animation.
     * @param {Boolean} [options.forwards=true] Whether to traverse from source-> target, or target->source.
     * @param {Number} [options.dwell=250] How long, in milliseconds, to dwell on each node as the overlay traverses the path.
     * @param {Number} [options.speed=100] How many pixels per second to travel. *Note*: this is in seconds, not milliseconds.
     * @param {Number} [options.rate=30] Frame rate, in milliseconds.
     * @returns {boolean}
     */
    jsPlumb.Connection.prototype.animateOverlay = function(overlaySpec, options) {

        var self = this;
        var handle = new jsPlumbUtil.EventGenerator();

        var length = self.getConnector().getLength();

        options = options || {};
        var id = jsPlumbUtil.uuid();

        var forwards = options.forwards !== false,
            rate = options.rate || 30, // ms
            dwell = options.dwell || 250,
            speed = options.speed || 100, // pixels per second.
        // how long will the animation last? it's the length divided by the
        // pixels per second. here note we convert from seconds to milliseconds.
        // the 'speed' member is given in seconds.
            duration = length / speed * 1000,
        // recompute frame count
            frames = duration / rate,
        // recompute distance per frame
            perFrame = (1 / frames) * (forwards ? 1 : -1),
            isFinal = options.isFinal !== false,
            startLocation = forwards ? 0 : 1,
            finished = function() {
                return forwards ? current >= 1 : current <= 0;
            },
            startNode = forwards ? self.source : self.target,
            endNode = forwards ? self.target : self.source,
            current = startLocation, timer, overlay,
            tick = function() {
                current += perFrame;
                if (finished()) stop();
                else {
                    overlay.loc = current;
                    self.repaint();
                }
            },
            spec;

        if (typeof overlaySpec === "string") {
            spec = [ overlaySpec, { location:startLocation, id:id }];
        } else {
            var os = jsPlumb.extend({}, overlaySpec[1]);
            os.location = startLocation;
            os.id = id;

            spec = [ overlaySpec[0], os ];
        }

        var startTraversal = function() {
            handle.fire(events.start, self);
            overlay = self.addOverlay(spec);
            timer = window.setInterval(tick, rate);
        };

        var start = function() {
            handle.fire(events.nodeTraverseStart, {connection:self, element:startNode});
            jsPlumb.addClass(startNode, classes.nodeTraversing);
            self.addClass(classes.edgeTraversing);
            window.setTimeout(function() {
                jsPlumb.removeClass(startNode, classes.nodeTraversing);
                handle.fire(events.nodeTraverseEnd, {connection:self, element:startNode});
                startTraversal();
            }, dwell);
        };

        var stop = function() {
            self.removeOverlay(id);
            window.clearInterval(timer);
            if (isFinal) {
                jsPlumb.addClass(endNode, classes.nodeTraversing);
                window.setTimeout(function() {
                    jsPlumb.removeClass(endNode, classes.nodeTraversing);
                    self.removeClass(classes.edgeTraversing);
                    handle.fire(events.end, self);
                }, dwell);
            }
            else {
                self.removeClass(classes.edgeTraversing);
                handle.fire(events.end, self);
            }

        };

        if (options.previous) {
            options.previous.bind(events.end, start);
        }
        else {
            start();
        }

        return handle;
    };
})();
/*
 * AutoSaver
 *
 * Copyright 2014 jsPlumb
 * http://jsplumbtoolkit.com
 *
 * This software is not free.
 *
 * Dependencies:
 *
 * jsPlumbToolkitUtil
 *
 * Headless : yes
 *
 */
;
(function () {

    "use strict";

    var root = this;

    var prefixes = [ "node", "port", "edge" ],
        suffixes = [ "Refreshed", "Added", "Removed", "Updated", "Moved" ];

    root.jsPlumbToolkitUtil.AutoSaver = function (instance, url, success, error) {

        var _save = function () {
            instance.save({
                url: url,
                success: success,
                error: error
            });
        };

        for (var i = 0; i < prefixes.length; i++)
            for (var j = 0; j < suffixes.length; j++)
                instance.bind(prefixes[i] + suffixes[j], _save);
    };

    root.jsPlumbToolkitUtil.CatchAllEventHandler = function (instance) {
        var _f = function () {
            instance.fire("dataUpdated");
        };

        for (var i = 0; i < prefixes.length; i++)
            for (var j = 0; j < suffixes.length; j++)
                instance.bind(prefixes[i] + suffixes[j], _f);
    };

}).call(this);

/**
 * Models a selection of Nodes/Ports end Edges.
 */
;
(function () {

    var root = this;
    var UTIL = root.jsPlumbToolkitUtil;
    var exports = UTIL;
    var JUTIL = jsPlumbUtil;


    /**
     * @class Selection
     */
    /**
     * @constructor
     * @param {Object} params Constructor params
     * @param {jsPlumbToolkitInstance} params.toolkit jsPlumb Toolkit instance to which this Selection belongs.
     * @param {Function} [params.generator] Optional function that can be called to fill the selection. You'd use this
     * when you are rendering individual selections and you need to be able to refresh the whole view based on some
     * change in the data model.
     * @param {Function} [params.onClear] Optional function to call when the selection is cleared.
     */
    exports.Selection = function (params) {

        jsPlumbUtil.EventGenerator.apply(this, arguments);

        var toolkit = params.toolkit,
            _nodes = [],
            _edges = [],
            maxNodes = Math.Infinity,
            maxEdges = Math.Infinity,
            capacityPolicy,
            generator = params.generator,
            _objMap = {},
            self = this,
            _onClear = params.onClear || function () {
            },
            _getList = function (obj) {
                return obj.objectType === "Edge" ? _edges : _nodes;
            },
            _pushToList = function(obj) {
                var deselected = [];
                var list = _getList(obj), _max = obj.objectType === "Edge" ? maxEdges : maxNodes;
                if (list.length >= _max) {
                    if (capacityPolicy === exports.Selection.DISCARD_NEW) {
                        return false;
                    }
                    else {
                        deselected = list.splice(0, 1);
                        _fireListEvent(deselected[0], "Removed");
                        delete _objMap[deselected[0].getFullId()];
                    }
                }
                list.push(obj);
                _fireListEvent(obj, "Added");
                return deselected;
            },
            _fireListEvent = function(obj, suffix) {
                var evt = obj.objectType.toLowerCase() + suffix,
                    payloads = {
                        "Node":{ data:obj.data, node:obj },
                        "Port":{ data:obj.data, node:obj.node, port:obj },
                        "Edge":{ data:obj.data, edge:obj}
                    };
                self.fire(evt, payloads[obj.objectType]);
            };

        this.getModel = toolkit.getModel;
        this.setSuspendGraph = toolkit.setSuspendGraph;
        this.getNodeId = toolkit.getNodeId;
        this.getEdgeId = toolkit.getEdgeId;
        this.getPortId = toolkit.getPortId;
        this.getNodeType = toolkit.getNodeType;
        this.getEdgeType = toolkit.getEdgeType;
        this.getPortType = toolkit.getPortType;
        this.getObjectInfo = toolkit.getObjectInfo;
        this.isDebugEnabled = toolkit.isDebugEnabled;
        /*var selfbind = this.bind;
        this.bind = function(evt, fn) {
            if (evt === "dataLoadStart" || evt === "dataLoadEnd" || evt == "graphCleared" || evt == "nodeAdded" || evt == "edgeAdded")
                selfbind(evt, fn);

            toolkit.bind(evt, fn);
        };*/

        var _addOne = function (obj, evtPipe) {
                if (!_objMap[obj.getFullId()]) {
                    var result = _pushToList(obj);
                    if (result === false) {
                        return [ [], [] ];
                    }
                    else {
                        _objMap[obj.getFullId()] = obj;
                        if (evtPipe) evtPipe(obj, true);
                        return [ [obj], result ];
                    }
                }
                return [ [],  [] ];
            },
            _removeOne = function (obj, evtPipe) {
                var wasRemoved = JUTIL.removeWithFunction(_getList(obj), function (n) {
                    return n.id == obj.id;
                });
                if (wasRemoved) {
                    _fireListEvent(obj, "Removed");
                }
                delete _objMap[obj.getFullId()];
                if (evtPipe) evtPipe(obj, false);
                return [ [], [] ];
            },
            _toggle = function (obj, evtPipe) {
                if (_objMap[obj.getFullId()])
                    return _removeOne(obj, evtPipe);
                else
                    return _addOne(obj, evtPipe);
            },
            _makeSenseOf = function (o, fn, evtPipe) {
                var out = [], deselections = [];
                if (o == null) return out;
                var _one = function (_o) {
                    var __o;
                    if (jsPlumbUtil.isString(_o)) {
                        __o = toolkit.getNode(_o) || toolkit.getEdge(_o);
                        if (__o != null) {
                            var objects = fn(__o, evtPipe);
                            out.push.apply(out, objects[0]);
                            deselections.push.apply(deselections, objects[1]);
                        }
                    }
                    else if (_o.eachNode && _o.eachEdge) {
                        _o.eachNode(function (i, e) {
                            _one(e);
                        });
                        _o.eachEdge(function (i, e) {
                            _one(e);
                        });
                    }
                    else if (_o.each) {
                        _o.each(function (i, e) {
                            _one(e.vertex || e);
                        });
                    }
                    else if (_o.length != null) {
                        for (var i = 0; i < _o.length; i++)
                            _one(_o[i], evtPipe);
                    }
                    else {
                        var objects = fn(_o, evtPipe);
                        out.push.apply(out, objects[0]);
                        deselections.push.apply(deselections, objects[1]);
                    }
                };

                _one(o);

                return [out, deselections];

            }.bind(this);

        toolkit.bind("nodeRemoved", function (o) {
            _removeOne(o.node);
        });
        toolkit.bind("portRemoved", function (o) {
            _removeOne(o.port);
        });
        toolkit.bind("edgeRemoved", function (o) {
            _removeOne(o.edge);
        });
        toolkit.bind("edgeTarget", function(o) {
           if (_objMap[o.edge.getFullId()]) {
               self.fire("edgeTarget", o);
           }
        });
        toolkit.bind("edgeSource", function(o) {
            if (_objMap[o.edge.getFullId()]) {
                self.fire("edgeSource", o);
            }
        });

        toolkit.bind("nodeUpdated", function(p) {
            if (_objMap[p.node.getFullId()]) self.fire("nodeUpdated", p);
        });

        toolkit.bind("edgeUpdated", function(p) {
            if (_objMap[p.edge.getFullId()]) self.fire("edgeUpdated", p);
        });

        toolkit.bind("portUpdated", function(p) {
            if (_objMap[p.port.getFullId()]) self.fire("portUpdated", p);
        });

/*
        self.bind("dataUpdated", function() {
            self.reload();
        });*/

        /**
         * Removes the given object from the selection.
         * @method remove
         * @param {Node|Edge|Node[]|Edge[]|Path} obj Object(s) to remove. May take many forms - a Node, Node Id, or Edge, or a list of these,
         * or a Path.
         */
        this.remove = function (obj, evtPipe) {
            return _makeSenseOf(obj, _removeOne, evtPipe);
        };

        /**
         * Appends the given object to the selection.
         * @method append
         * @param {Node|Edge|Node[]|Edge[]|Path} obj Object(s) to add. May take many forms - a Node, Node Id, or Edge, or a list of these,
         * or a Path.
         */
        this.append = function (obj, evtPipe) {
            return _makeSenseOf(obj, _addOne, evtPipe);
        };

        /**
         * Toggles the given object's membership in the current selection. If `obj` is a Path, then the individual
         * members of the Path are toggled independently.
         * @method toggle
         * @param {Node|Edge|Node[]|Edge[]|Path} obj Object(s) to add. May take many forms - a Node, Node Id, or Edge, or a list of these,
         * or a Path.
         */
        this.toggle = function (obj, evtPipe) {
            return _makeSenseOf(obj, _toggle, evtPipe);
        };

        /**
         * Sets the maximum number of nodes the selection can hold. The action taken when appending a node that would
         * take the selection above its limit depends on the current `capacityPolicy`, which can be either
         * Selection.DISCARD_EXISTING (the default) or Selection.DISCARD_NEW.
         * @method setMaxNodes
         * @param {Integer} _maxNodes
         */
        this.setMaxNodes = function(_maxNodes) {
            maxNodes = _maxNodes;
        };

        /**
         * Sets the maximum number of edges the selection can hold. The action taken when appending an edge that would
         * take the selection above its limit depends on the current `capacityPolicy`, which can be either
         * Selection.DISCARD_EXISTING (the default) or Selection.DISCARD_NEW.
         * @method setMaxEdges
         * @param {Integer} _maxEdges
         */
        this.setMaxEdges = function(_maxEdges) {
            maxEdges = _maxEdges;
        };

        /**
         * Sets the action taken when appending an edge or node that would
         * take the selection above its limit for that given type. Depends on the current `capacityPolicy`,
         * which can be either `jsPlumbToolkitUtil.Selection.DISCARD_EXISTING` (the default) or `jsPlumbToolkitUtil.Selection.DISCARD_NEW`.
         * @method setCapacityPolicy
         * @param {String} policy One of `jsPlumbToolkitUtil.Selection.DISCARD_EXISTING` (which removes the 0th entry from the list
         * before insertion of the new value) or `jsPlumbToolkitUtil.Selection.DISCARD_NEW`.
         */
        this.setCapacityPolicy = function(policy) {
            capacityPolicy = policy;
        };

        /**
         * Clears this selection.
         * @method clear
         */
        this.clear = function (doNotFireEvent) {
            _nodes.length = 0;
            _edges.length = 0;
            _objMap = {};
            if (!doNotFireEvent) _onClear(this);
        };

        /**
         * Reloads the content of this Selection, if a `generator` was supplied to the constructor. Otherwise
         * does nothing. A data load start event is fired first, followed by a call to the generator to repopulate,
         * and then a data load end event is fired.  So calling this method on a Selection that you are rendering
         * to a Surface will cause the Surface to repaint itself.
         */
        this.reload = function() {
            if (generator != null) {
                this.clear();
                this.fire("dataLoadStart");
                generator(this, toolkit);
                for (var i = 0; i < _nodes.length; i++) {
                    self.fire("nodeAdded", _nodes[i]);
                }
                for (var i = 0; i < edges.length; i++) {
                    self.fire("edgeAdded", _edges[i]);
                }
                this.fire("dataLoadEnd");
            }
        };

        /**
         * Iterates the objects of the given type in the selection, calling the supplied callback
         * for each item. The callback's signature should be `function(index, item)`. If you don't supply
         * `type`, the default of "Node" will be used.
         * @method each
         * @param {Function} fn Function to call with each item.
         * @param {String} [type="Node"]
         */
        this.each = function (fn, type) {
            var list = type != "Edge" ? _nodes : _edges;
            for (var i = 0; i < list.length; i++) {
                try {
                    fn(i, list[i]);
                }
                catch (e) {
                    jsPlumbUtil.log("Selection iterator function failed", e);
                }
            }
        };

        /**
         * Iterates the Nodes in the selection, calling the supplied callback
         * for each item. The callback's signature should be `function(index, item)`.
         * @method each
         * @param {Function} fn Function to call with each item.
         */
        this.eachNode = this.each;

        /**
         * Iterates the Edges in the selection, calling the supplied callback
         * for each item. The callback's signature should be `function(index, item)`.
         * @method each
         * @param {Function} fn Function to call with each item.
         */
        this.eachEdge = function (fn) {
            this.each(fn, "Edge");
        };

        /**
         * Get the current number of Nodes in the selection.
         * @method getNodeCount
         * @return {Number}
         */
        this.getNodeCount = function () {
            return _nodes.length;
        };

        /**
         * Gets the node at the given index.
         * @param idx Index of the Node to retrieve. Will return null if index out of range.
         * @returns {Node} A Node, or null.
         */
        this.getNodeAt = function(idx) {
            return _nodes[idx];
        };

        /**
         * Gets all the Nodes in the Selection.
         * @returns {Node[]}
         */
        this.getNodes = function() {
            return _nodes;
        };

        this.getNode = toolkit.getNode;

        this.getAllEdgesFor = function(node) {
            // need to get all edges and then filter to see if they're in the current selection.
            var e = node.getAllEdges(), _ = [];
            for (var i = 0; i < e.length; i++) {
                if (_objMap[e[i].getId()] != null)
                    _.push(e[i]);
            }
            return _;
        };

        /**
         * Get the current number of Edges in the selection.
         * @method getEdgeCount
         * @return {Number}
         */
        this.getEdgeCount = function () {
            return _edges.length;
        };

        /**
         * Gets the Node/Port at the given index.
         * @method get
         * @param {Integer} idx Index of the Node/Port to retrieve.
         * @return {Object} Node/Port at the given index, null if nothing found at that index.
         */
        this.get = this.getNodeAt = function (idx) {
            return _nodes[idx];
        };

        /**
         * Gets the Edge at the given index.
         * @method getEdge
         * @param {Integer} idx Index of the Edge to retrieve.
         * @return {Object} Edge at the given index, null if nothing found at that index.
         */
        this.getEdge = function (idx) {
            return _edges[idx];
        };

        this.setCapacityPolicy(exports.Selection.DISCARD_EXISTING);
    };

    exports.Selection.DISCARD_EXISTING = "discardExisting";
    exports.Selection.DISCARD_NEW = "discardNew";


}).call(this);

/*
 * Graph
 *
 * Copyright 2015 jsPlumb
 * http://jsplumbtoolkit.com
 *
 * Licensed under the GPL2 license.  This software is not free.
 *
 * This is a Javascript implementation of a Graph, containing either directed or undirected edges, from nodes that have a one to N
 * ports, with Djikstra and FloydWarshall shortest path algorithms.  Also offers several 'centrality' measurement functions.
 *
 */
;
(function () {

    "use strict";

    var root = this;
    var exports = root.jsPlumbGraph = {};

    exports.version = "0.1";
    exports.name = "jsPlumbGraph";

    var Base = function (data, graph) {
            var atts = {};
            this.setAttribute = function (key, value) {
                atts[key] = value;
            };
            this.getAttribute = function (key) {
                return atts[key];
            };
            var type = graph.getType(data || {});
            this.getType = function () {
                return type;
            };
            this.setType = function (t) {
                type = t;
            };
            this.graph = graph;
        },
        uuid = function () {
            return ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }));
        },
        _getId = function (data, idFunction, graph) {
            if (data == null) return uuid();
            else if (typeof data === 'string')
                return data;
            else {
                var idf = idFunction || graph.getIdFunction();
                return idf(data) || uuid();
            }
        },
        _getType = function (data) {
            return typeof data === 'string' ? { id: data } : data;
        },
        /**
         * This is a Node in the Graph. Each Node can have one or more Edges to any other Node; this Edge may be
         * directed.  A Node may also have zero or more Ports, which themselves may have one or more Edges to other Nodes
         * or to Ports on other Nodes.
         *
         * Every Node has an associated *indegree centrality* and *outdegree centrality*. These are measurements of the number
         * of links to and from the Node. Whenever an Edge is added or removed the indegree and outdegree centrality
         * values for the Node are recomputed. For further reading we suggest [Wikipedia](http://en.wikipedia.org/wiki/Centrality#Degree_centrality).
         *
         * You can instantiate a Node with any type of backing data you wish.  If you supply a String,
         * that value is assumed to be the Node's ID. If you supply a JSON object, an ID is extracted from that object,
         * either with the supplied `idFunction`, or, if that is null, by assuming that the ID exists in the JSON as the
         * `id` member.
         * @class Node
         * @constructor
         * @param {Object|String} [data] Optional data backing the node. This object can be of any type you like, but if you supply a String, that value will be assumed to be the Node's ID.
         * @param {Function} [idFunction] Optional function that can take a Node's data and return its ID. By default this looks for an `id` member in the backing data.
         * @param {Graph} graph Graph the Vertex belongs to.
         */
        Vertex = exports.Vertex = exports.Node = function (data, idFunction, graph) {
            var self = this;
            Base.apply(this, [ data, graph ]);
            this.objectType = "Node";

            /**
             * The Node's id. A String.
             * @property id
             * @type {String}
             */
            this.id = _getId(data, idFunction, graph);

            /**
             * Data associated with the Node.
             * @property data
             * @type {Object}
             */
            this.data = _getType(data);

            /**
             * Gets the Node's id, which, for Nodes, is just the `id` property. This method is overridden by Ports.
             * @method getFullId
             * @return {String} Node's id.
             */
            this.getFullId = function () {
                return this.id;
            };

            var edges = [],
                indegreeCentrality = 0,
                outdegreeCentrality = 0,
                nestedGraphs = [],
                ports = [],
                graphs = [],
                portMap = {};

            /**
             * Gets all Edges where this Node is either the source or the target of the Edge.
             * Note that this does *not* retrieve Edges on any Ports associated with this Node - for that, @see #getAllEdges.
             * @method getEdges
             * @param {Object} params Method parameters.
             * @param {Function} [params.filter] Optional Edge filter.
             * @return {Edge[]} List of edges.
             */
            this.getEdges = function (params) {
                if (params == null || params.filter == null) return edges;
                else {
                    var out = [];
                    for (var i = 0; i < edges.length; i++)
                        if (params.filter(edges[i])) out.push(edges[i]);
                    return out;
                }
            };

            /**
             * Gets all Edges where this Node is the source.
             * @method getSourceEdges
             * @returns {Edge[]}
             */
            this.getSourceEdges = function() {
                return this.getEdges({
                    filter:function(e) {
                        return e.source == this;
                    }.bind(this)
                });
            };

            /**
             * Gets all Edges where this Node is the target.
             * @method getTargetEdges
             * @returns {Edge[]}
             */
            this.getTargetEdges = function() {
                return this.getEdges({
                    filter:function(e) {
                        return e.target == this;
                    }.bind(this)
                });
            };

            /**
             * Adds an Edge to the Node.
             * @method addEdge
             * @param {Edge} edge The Edge to add.
             */
            this.addEdge = function (edge) {
                edges.push(edge);
                if (edge.source === self || !edge.isDirected()) {
                    outdegreeCentrality++;
                }
                if (edge.target === self || !edge.isDirected()) {
                    indegreeCentrality++;
                }
            };

            /**
             * Deletes an Edge from the Node.
             * @method deleteEdge
             * @param {Edge} edge The Edge to delete.
             */
            this.deleteEdge = function (edge) {
                var idx = -1;
                for (var i = 0; i < edges.length; i++) {
                    if (edges[i].getId() === edge.getId()) {
                        idx = i;
                        break;
                    }
                }
                if (idx > -1) {
                    edges.splice(idx, 1);
                    if (edge.source === self || !edge.isDirected()) {
                        outdegreeCentrality--;
                    }
                    if (edge.target === self || !edge.isDirected()) {
                        indegreeCentrality--;
                    }
                    return true;
                }
                return false;
            };

            /**
             * @method getAllEdges
             * @desc Gets all of the Edges connected to this Node, both on the Node itself and on all of its Ports.
             * @param {Object} [params] Method parameters.
             * @param {Function} [params.filter] Optional Edge filter.
             * @return {Edge[]} List of Edges.
             */
            this.getAllEdges = function (params) {
                var e = this.getEdges(params).slice(0);
                for (var i = 0; i < ports.length; i++) {
                    e.push.apply(e, ports[i].getEdges(params));
                }
                return e;
            };

            /**
             * Adds a sub-graph to this node. If you provide an existing Graph instance that does not have
             * an id, one will be assigned.
             * @method addGraph
             * @param {Graph|String} g Either a Graph instance, or the id you wish to assign to a new Graph.
             * @return {Graph} The Graph that was added.
             */
            this.addGraph = function (g) {
                g = typeof g == "string" ? new exports.Graph({id: g}) : g;
                graphs.push(g);
                if (!g.id)
                    g.id = "" + graphs.length;

                return g;
            };

            /**
             * Retrieves a sub-graph by id.
             * @method getGraph
             * @return {Graph} Sub-graph with the given id, null if not found.
             */
            this.getGraph = function (id) {
                for (var i = 0; i < graphs.length; i++) {
                    if (graphs[i].id === id)
                        return graphs[i];
                }
            };

            /**
             * Gets this Node's "indegree" centrality; a measure of how many other Nodes are connected to this Node as the target of some Edge.
             * @method getIndegreeCentrality
             * @return {Float} Indegree centrality for the Node.
             */
            this.getIndegreeCentrality = function () {
                var pc = 0;
                for (var i = 0; i < ports.length; i++)
                    pc += ports[i].getIndegreeCentrality();
                return indegreeCentrality + pc;
            };

            /**
             * Gets this Node's "outdegree" centrality; a measure of how many other Nodes this Node is connected to as the source of some Edge.
             * @method getOutdegreeCentrality
             * @return {Float} Outdegree centrality for the Node.
             */
            this.getOutdegreeCentrality = function () {
                var pc = 0;
                for (var i = 0; i < ports.length; i++)
                    pc += ports[i].getOutdegreeCentrality();
                return outdegreeCentrality + pc;
            };

            /**
             * Gets all Ports associated with this Node.
             * @method getPorts
             * @return {Port[]} List of Ports, empty list if none registered.
             */
            this.getPorts = function () {
                return ports;
            };

            /**
             * Adds a Port to the Node.
             * @method addPort
             * @param {Object} [data] Optional data backing the Port. This object can be of any type you like.
             * @param {Function} [idFunction] Optional function that can take a Port's data and return its ID. By default this looks for an `id` member in the backing data.
             * @return {Port} The newly created Port.
             */
            this.addPort = function (data, idFunction) {
                var id = _getId(data, idFunction, graph), p = self.getPort(id);
                if (p == null) {
                    p = new Port(data, idFunction, self);
                    ports.push(p);
                    portMap[p.id] = p;
                }
                return p;
            };

            /**
             * Sets the underlying data for the Port with the given id.  If the Port does not yet exist, it is created.
             * @method setPort
             * @param {String} id Id of the Port for which to set data.
             * @param {Object} data Data to set for the Port.
             */
            this.setPort = function (id, data) {
                var p = self.getPort(id);
                if (!p) {
                    p = self.addPort({id: id});
                }
                p.data = data;
                p.setType(this.graph.getType(data));
                return p;
            };

            /**
             * Gets the Port with the given id, null if nothing found.
             * @method getPort
             * @param {String} id Port id.
             * @return {Port} Port with the given id, or null if not found.
             */
            this.getPort = function (portId) {
                return portMap[portId];
            };

            var _portId = function (port) {
                return port.constructor == jsPlumbGraph.Port ? port.id : port;
            };

            /**
             * Removes the given Port.
             * @method removePort
             * @param {Port|String} Either a Port, or a Port id.
             */
            this.removePort = function (port) {
                if (port) {
                    var id = _portId(port), idx = -1,
                        exists = false;

                    for (var i = 0; i < ports.length; i++) {
                        if (ports[i].id === id) {
                            idx = i;
                            break;
                        }
                    }
                    if (idx != -1) {
                        ports.splice(idx, 1);
                        exists = true;
                    }

                    delete portMap[id];
                }
                return exists;
            };

            var defaultInternalCost = 0;
            var internalEdges = { };

            /**
             * Sets the default cost of travelling from one Port to another inside some Node. When a Node is created, this value is set to 1.
             * @method setDefaultInternalCost
             * @param {Float} cost Default internal cost.
             */
            this.setDefaultInternalCost = function (c) {
                defaultInternalCost = c;
            };

            /**
             * Gets an "internal" Edge from one Port to another.
             * @method getInternalEdge
             * @param {Port|String} source Source Port.
             * @param {Port|String} target Target Port.
             * @return {Object} An object containing `\{ source:..., target:..., cost:..., directed:... \}`.
             */
            this.getInternalEdge = function (source, target) {
                var spid = _portId(source), tpid = _portId(target),
                    out = { source: portMap[spid], target: portMap[tpid], cost: Infinity };

                if (out.source && out.target) {
                    var ie = internalEdges[spid + "-" + tpid] || { cost: defaultInternalCost, directed: false };
                    for (var i in ie)
                        out[i] = ie[i];
                }
                return out;
            };

            /**
             * Sets the cost and directedness of some internal Edge.
             * @method setInternalEdge
             * @param {Port|String} source Source Port.
             * @param {Port|String} target Target Port.
             * @param {Float} cost Cost to set. If you leave this as null, the default will be used.
             * @param {Boolean} [directed] Whether or not the internal Edge is directed.
             */
            this.setInternalEdge = function (source, target, cost, directed) {
                var spid = _portId(source), tpid = _portId(target);
                internalEdges[spid + "-" + tpid] = {
                    cost: cost || defaultInternalCost,
                    directed: directed
                };
                return this.getInternalEdge(source, target);
            };

            /**
             * Returns a string representation of the Node.
             * @return {String} Node dumped to a string.
             */
            this.inspect = function () {
                var i = "{ id:" + this.id + ", edges:[\n";
                for (var j = 0; j < edges.length; j++) {
                    i += edges[j].inspect() + "\n";
                }
                i += "]}";
                return i;
            };
        },
        /**
         * A Port resides on a Node, and may be the source/target of one or more connections. A convenient way to think
         * of Ports is as the columns in a database table: they belong to a table, but it is the columns themselves that
         * have relationships with other columns.
         * @class Port
         * @extends Node
         */
        Port = exports.Port = function (data, idFunction, node) {
            Vertex.apply(this, [ data, idFunction, node.graph ]);
            this.objectType = "Port";

            /**
             * @property id The Port's id. This must be unique on a Node, but not necessarily unique with a given Graph.
             * @type {String}
             * @see getFullId
             */

            /**
             * Gets the Node this Port belongs to.
             * @method getNode
             * @return {Node} The Node this Port belongs to.
             */
            this.getNode = function () {
                return node;
            };

            /**
             * Overrides the `getFullId` of Node to return a value in dotted notation of the form `nodeId.portId`.
             * @method getFullId
             * @return {String} The Port's "full" id, ie. the Port's id prepended by the parent Node's id, eg `"BooksTable.idColumn"```.
             */
            this.getFullId = function () {
                return node.id + this.graph.getPortSeparator() + this.id;
            };

            /**
             * @method isChildOf
             * @param {Node} node Node to test if this is a child.
             * @return {Boolean} True if this Port is a child of the given Node, false otherwise.
             */
            this.isChildOf = function (_node) {
                return node == _node;
            };

            this.getPorts = this.addPort = this.deletePort = this.getPort = null;
        },

        /**
         * This is an Edge in the graph.  There can be one or zero of these for every pair of Nodes/Ports in the Graph.  Each Edge has an associated "cost", and may be either bidirectional
         * or unidirectional.
         * @class Edge
         * @constructor
         * @param {Object} params Edge parameters.
         * @param {Object} [params.data] Optional backing data for the edge.
         * @param {Node|Port} params.source Edge's source.
         * @param {Node|Port} params.target Edge's target.
         * @param {Number} [params.cost=1] Edge's cost. Defaults to 1.
         * @param {Boolean} [params.directed] Whether or not the Edge is directed. Default is true.
         */
        Edge = exports.Edge = function (params) {
            Base.call(this, params.data, params.graph);
            /**
             * Source of the Edge.
             * @property source
             * @type {Node|Port}
             */
            this.source = params.source;
            /**
             * Target of the Edge.
             * @property target
             * @type {Node|Port}
             */
            this.target = params.target;

            this.objectType = "Edge";
            var self = this,
                _cost = params.cost || 1,
                _directed = !(params.directed === false),
                _id = params.id,
                _connectionId = null;

            /**
             * Data for the Edge.
             * @property data
             * @type {Object}
             */
            this.data = params.data || {};

            /**
             * Gets the cost for this edge. Defaults to 1.
             * @method getCost
             * @return {Number} Edge cost.
             */
            this.getCost = function () {
                return _cost;
            };

            /**
             * Sets the cost for this edge.
             * @method  setCost
             * @param {Number} c Edge cost.
             */
            this.setCost = function (c) {
                _cost = c;
            };

            /**
             * Gets the id for this Edge.
             * @method getId
             * @return {Number} Edge id.
             */
            this.getId = this.getFullId = function () {
                return _id === null ? self.source.id + "_" + self.target.id : _id;
            };
            this.setId = function (id) {
                _id = id;
            };

            /**
             * Gets whether or not the Edge is directed.
             * @method isDirected
             * @return {Boolean} True if the Edge is directed (unidirectional), false otherwise.
             */
            this.isDirected = function () {
                return _directed;
            };

            /**
             * Sets whether or not the Edge is directed.
             * @method setDirected
             */
            this.setDirected = function(directed) {
                _directed = directed;
            };

            /**
             * Returns a string representation of the Edge.
             * @return {String} Edge dumped to a string.
             */
            this.inspect = function () {
                if (_id != null)
                    return "{ id:" + _id + ", connectionId:" + _connectionId + ", cost:" + _cost + ", directed:" + _directed + ", source:" + self.source.id + ", target:" + self.target.id + "}";
            };
        },
        /**
         * A Graph.  Contains a list of Vertex objects, each of which has 0..N Ports, and a list of Edge objects. Every instance
         * of the jsPlumb Toolkit is backed by an instance of this lass.
         *
         * A good discussion on Graphs can be found on Wikipedia: http://en.wikipedia.org/wiki/Graph_(mathematics).
         * @class Graph
         * @constructor
         * @param {Object} [params] Constructor parameters. Optional. The Graph class has sensible defaults.
         * @param {Boolean} [params.defaultDirected=true] Whether edges are directed by default.
         * @param {Function} [params.idFunction] Function to use to extract an appropriate ID from the JSON for a give node. Defaults to returning the 'id' property of the JSON.
         * @param {Boolean} [params.enableSubgraphs=false] If true, Nodes are Graphs themselves, and can have child Nodes. If you enable this then you cannot use slashes (/) in your Node ids, as they will be treated as components of a path to a Node in a nested Graph.
         * @param {Number} [params.defaultCost=1] Default cost for Edges.
         * @param {String} [params.portSeparator="."] The character(s) used to separate ports from nodes in port ids.
         */
        Graph = exports.Graph = function (params) {
            params = params || {};
            this.vertices = [];
            this.edges = [];
            this.id = params.id;
            var _vertexMap = {},
                _vertexCount = 0,
                _edgeMap = {},
                _edgeCount = 0,
                defaultDirected = !(params.defaultDirected === false),
                defaultCost = params.defaultCost || 1,
                self = this,
                _defaultIdFunction = params.idFunction || function (d) {
                    return d.id;
                },
                typeFunction = params.typeFunction || function (d) {
                    return d.type || "default";
                },
                enableSubgraphs = params.enableSubgraphs === true,
                portSeparator = params.portSeparator || ".";

            /**
             * Sets the default function to use to extract an appropriate ID from the JSON for any given object.
             * @method setIdFunction
             * @param {Function} idFunction Function to use to extract IDs.
             */
            this.setIdFunction = function (f) {
                _defaultIdFunction = f;
            };

            /**
             * Gets the current function to use to extract an appropriate ID from the JSON for any given object.
             * @method getIdFunction
             * @return {Function} Function in use for extracting IDs.
             */
            this.getIdFunction = function () {
                return _defaultIdFunction;
            };

            /**
             * Sets the default function to use to extract an appropriate type from the JSON for any given object.
             * @method setIdFunction
             * @param {Function} f Function to use to extract IDs.
             */
            this.setTypeFunction = function (f) {
                typeFunction = f;
            };

            /**
             * Gets the type for some data, by running it through the current typeFunction.
             * @param {Object} data Object to get type from.
             */
            this.getType = function (data) {
                return typeFunction(data);
            };

            /**
             * Sets whether or not Nodes are Graphs themselves, and can have child Nodes. If you enable this
             * then you cannot use slashes (/) in your Node ids, as they will be treated as components of a path
             * to a Node in a nested Graph.
             * @param {Boolean} enable True to enable, false to disable.
             */
            this.setEnableSubgraphs = function (v) {
                enableSubgraphs = v;
            };

            /**
             * Sets the character(s) used to separate ports from nodes in port ids. By default this is '.', ie a
             * port is addressed as `nodeId.portId`. This may need to be changed depending on the data in your model.
             * @method setPortSeparator
             * @param {String} separator Separator to use.
             */
            this.setPortSeparator = function (ps) {
                portSeparator = ps;
            };

            /**
             * Gets the current port separator.
             * @return {String} Port separator string. Default is "."
             */
            this.getPortSeparator = function () {
                return portSeparator;
            };

            var _getVertex = function (e, createPortsIfMissing) {
                if (e == null) return null;
                // if not a string, check if its an object
                if (typeof e != "string") {
                    if (e.constructor == exports.Port || e.constructor == exports.Node) return e;
                    var orig = e;
                    // if its an object from which we could get something that looks like an id, get the id and continue with the id lookup code.
                    e = _defaultIdFunction(e);
                    // otherwise, return.
                    if (typeof e != "string") return orig;
                }

                var path = enableSubgraphs ? e.split("/") : [ e ],
                    _one = function (_id) {
                        if (_vertexMap[_id]) return _vertexMap[_id];
                        // otherwise, look for a node by assuming dotted notation.
                        var np = _id.split(portSeparator),
                            nodeId = np[0],
                            node = _vertexMap[nodeId];

                        if (np.length === 2 && node != null) {
                            var p = node.getPort(np[1]);
                            if (p == null && createPortsIfMissing)
                                p = node.addPort(np[1]);
                            return p;
                        }
                        else
                            return node;
                    };

                if (path.length == 1) return _one(path[0]);
                else if (path.length > 1 && path % 2 == 0)
                    throw "Subgraph path format error.";
                else {
                    // if path empty then this is a node/port lookup on the root. otherwise path should have an
                    // odd number of components, since it consists of a series of node/graph entries followed by
                    // a final node id.
                    var currentNode = null, currentGraph = null;
                    for (var i = 0; i < path.length - 1; i += 2) {
                        currentNode = _one(path[i]);
                        currentGraph = currentNode.getGraph(path[i + 1]);
                    }
                    return currentGraph.getVertex(path[path.length - 1]);
                }
            };

            // -------------------------               public API               -----------------------

            /**
             * Clears the Graph of all its Nodes, Ports and Edges.
             * @method clear
             */
            this.clear = function () {
                self.vertices.splice(0, self.vertices.length);
                _vertexCount = 0;
                _edgeCount = 0;
                _vertexMap = {};
                _edgeMap = {};
            };

            /**
             * Gets all the Nodes in the Graph.
             * @method getNodes
             * @return {Node[]} All the Nodes in the Graph.
             */
            this.getVertices = this.getNodes = function () {
                return self.vertices;
            };

            /**
             * Gets the count of Nodes in the Graph.
             * @method getNodeCount
             * @return {Integer} The total number of Nodes in the graph.
             */
            this.getVertexCount = this.getNodeCount = function () {
                return self.vertices.length;
            };

            /**
             * Returns the Node at the given index (used for bulk init type purposes)
             * @method getNodeAt
             * @param {Integer} index Index of the Node to retrieve
             * @return {Node} Node at the given index.
             */
            this.getVertexAt = this.getNodeAt = function (index) {
                return self.vertices[index];
            };

            /**
             * Returns the total number of Edges in the graph.
             * @method getEdgeCount
             * @return {Integer} The total number of Edges.
             */
            this.getEdgeCount = function () {
                return _edgeCount;
            };

            /**
             * Adds an Edge to the Graph.
             * @method addEdge
             * @param {Object} params Parameters for new Edge.
             * @param {String|Node|Port} params.source Source for the Edge - a Node, Port or Node/Port id.
             * @param {String|Node|Port} params.target Target for the Edge - a Node, Port or Node/Port id.
             * @param {Integer} [params.cost=1] Edge cost. This is used when computing shortest paths through the graph. If
             * an Edge is not `directed`, then the same cost is applied regardless of the direction of traversal.
             * @param {Boolean} [params.directed=true] Whether or not the Edge is directed.
             * @param {Object} [data] Optional data to associate with the Edge. The default edgeIdFunction
             * @return {Edge} The Edge that was added.
             */
            this.addEdge = function (params, idFunction) {
                var directed = params.directed == null ? defaultDirected === true : !(params.directed === false),
                    cost = params.cost || defaultCost,
                    id = _getId(params.data, idFunction, this),
                    source = _getVertex(params.source, true),
                    target = _getVertex(params.target, true);

                if (source == null || source.objectType == null) throw new TypeError("Unknown source node [" + params.source + "]");
                if (target == null || target.objectType == null) throw new TypeError("Unknown target node [" + params.target + "]");

                var edge = new Edge({
                    source: source,
                    target: target,
                    cost: cost,
                    directed: directed,
                    data: params.data || {},
                    id: id,
                    graph: this
                });

                edge.source.addEdge(edge);
                edge.target.addEdge(edge);

                _edgeMap[id] = edge;
                _edgeCount++;

                return edge;
            };

            /**
             * Adds a Node to the Graph
             * @method addNode
             * @param {Object} data Backing data for the Node
             * @param {Function} [idFunction] Optional function to use to retrieve ID from backing data. Defaults to retrieving `id` from data object.
             * @param {Node} The Node that was added.
             */
            this.addVertex = this.addNode = function (data, idFunction) {
                var v = new Vertex(data, idFunction || _defaultIdFunction, this);
                if (!_vertexMap[v.id]) {
                    this.vertices.push(v);
                    _vertexMap[v.id] = v;
                    v._id = _vertexCount++;
                    return v;
                }
                return null;
            };

            /**
             * Adds a list of Nodes to the Graph
             * @method addNodes
             * @param {Object[]} data List of data objects, one for each Node to be added.
             * @param {Function} [idFunction] Optional function to use to retrieve ID from backing data. Defaults to retrieving `id` from data object.
             */
            this.addVertices = this.addNodes = function (data, idFunction) {
                for (var i = 0; i < data.length; i++) {
                    this.addVertex(data[i], idFunction || _defaultIdFunction);
                }
            };

            /**
             * Deletes a Node
             * @method deleteNode
             * @param {Node|String} node Either a Node, or a Node id.
             */
            this.deleteVertex = this.deleteNode = function (vertex) {
                var v = _getVertex(vertex);
                if (v) {
                    var idx = -1;
                    for (var i = 0; i < self.vertices.length; i++) {
                        if (self.vertices[i].id === v.id) {
                            idx = i;
                            break;
                        }
                    }
                    if (idx > -1) {
                        self.vertices.splice(idx, 1);
                    }
                    var edges = v.getEdges();
                    for (var j = 0; j < edges.length; j++) {
                        self.deleteEdge(edges[j]);
                    }
                    _edgeCount -= edges.length;

                    if (v.getPorts) {
                        var ports = v.getPorts();
                        for (var k = 0; k < ports.length; k++) {
                            self.deleteVertex(ports[k]);
                        }
                    }

                    delete _vertexMap[v.id];
                    _vertexCount--;
                }
            };

            /**
             * Deletes an edge.
             * @method deleteEdge
             * @param {Edge} edge Edge to delete.
             */
            this.deleteEdge = function (edge) {
                edge = this.getEdge(edge);
                if (edge == null) return;
                var v = _getVertex(edge.source);
                if (v && v.deleteEdge(edge)) {
                    _edgeCount--;
                }
                var v2 = _getVertex(edge.target);
                if (v2) {
                    v2.deleteEdge(edge);
                }
                delete _edgeMap[edge.getId()];
            };

            /**
             * Gets an Edge by id, or if the given object is already an Edge, hands that back.
             * @method getEdge
             * @param {String|Edge|Object} e ID of the Edge to retrieve, or an actual Edge, or some data from which an ID could be derived.
             * @return {Edge} The requested Edge, if found, otherwise null.
             */
            this.getEdge = function (e) {
                if (e == null) return;
                if (typeof e != "string") {
                    if (e.constructor == exports.Edge) return e;
                    var orig = e;
                    // if its an object from which we could get something that looks like an id, get the id and continue with the id lookup code.
                    e = _defaultIdFunction(e);
                    // otherwise, return.
                    if (typeof e != "string") return orig;
                }
                return _edgeMap[e];
            };

            /**
             * For some given node, get a subset of edges that match the given filter function.
             * @param {Object} params Method parameters
             * @param {Boolean} [params.source] If true, only match edges for which this node is the source.
             * @param {Boolean} [params.target] If true, only match edges for which this node is the target.
             * @param filter
             */
            this.getEdges = function (params) {

                params = params || {};
                var s = params.source,
                    t = params.target,
                    f = params.filter || function () {
                        return true;
                    },
                    fe = function (e) {
                        return (s == null || ( (e.source == node) === s)) && (t == null || ( (e.target == node) === t));
                    },
                    out = [],
                    match = function (e) {
                        if (f(e) && fe(e)) out.push(e);
                    },
                    i;

                if (params.node) {
                    var node = _getVertex(params.node);
                    var e = node.getAllEdges();
                    for (i = 0; i < e.length; i++)
                        match(e[i]);
                }
                else {
                    for (i in _edgeMap)
                        match(_edgeMap[i]);
                }

                return out;
            };

            /**
             * Finds the shortest path from source to target, using the Djikstra algorithm.
             * @method findPath
             * @param {Node|String} source Source Node or Node ID.
             * @param {Node|String} target Target Node or Node ID.
             * @param {Boolean} [strict=true] Sets whether or not paths are searched strictly by the given source/target. If, for instance, you supply a node as the source, but there are only edges connected to ports on that node, by default these edges will be ignored. Switching `strict` to false will mean these edges are considered.
             * @param {Function} [nodeFilter] Optional function that is given each Node's backing data and asked to return true or false - true means include the Node, false means exclude it.
             * @param {Function} [edgeFilter] Optional function that is given each Edge's backing data and asked to return true or false - true means include the Edge, false means exclude it.
             * @return An array like `[  \{ vertex, cost, edge \}, \{ vertex,cost,edge \} ... ]` when successful; when unsuccessful the three compiled
             * tables are returned - distances to nodes, each node's previous node, and the associated edge.  so you can call this method with
             * no target set and get the entire table populated.
             */
            this.findPath = function (source, target, strict, nodeFilter, edgeFilter) {
                source = _getVertex(source);
                target = _getVertex(target);
                return Djikstra.compute({ graph: self, source: source, target: target, strict: !(strict === false), nodeFilter: nodeFilter, edgeFilter: edgeFilter });
            };

            /**
             * Finds the distance between source and target.
             * @method getDistance
             * @param {Node|String} source Source Node or Node ID.
             * @param {Node|String} target Target Node or Node ID.
             * @param {Boolean} [strict=true] Sets whether or not paths are searched strictly by the given source/target. If, for instance, you supply a node as the source, but there are only edges connected to ports on that node, by default these edges will be ignored. Switching `strict` to false will mean these edges are considered.
             * @return {Number} Distance from the source to the target.
             */
            this.getDistance = function (source, target, strict) {
                var info = this.findPath(source, target, strict);
                return info.pathDistance;
            };

            /**
             * Gets the Node or Port with the given id, null if not found.
             * @method getNode
             * @param {String} id Node or Port id.
             * @return {Node} Node/Port if found, null otherwise.
             */
            this.getVertex = this.getNode = _getVertex;

            /**
             * Sets the target Node/Port for some Edge.
             * @method setTarget
             * @param {Node|Port|String} o Node/Port/id for new Edge target
             */
            this.setTarget = function (edge, o) {
                o = _getVertex(o);
                if (o == null) return { success:false };
                var old = edge.target;
                edge.target.deleteEdge(edge);
                edge.target = o;
                o.addEdge(edge);
                return { old: old, edge: edge, "new": o, success:true };
            };

            /**
             * Sets the source Node/Port for some Edge.
             * @method setSource
             * @param {Node|Port|String} o Node/Port/id for new Edge source
             */
            this.setSource = function (edge, o) {
                o = _getVertex(o);
                if (o == null) return { success:false };
                var old = edge.source;
                edge.source.deleteEdge(edge);
                edge.source = o;
                o.addEdge(edge);
                return { old: old, edge: edge, "new": o, success:true };
            };

            /**
             * Returns the path from source to target as a String.
             * @method printPath
             * @return {String} Printed path. Mostly useful for debugging.
             * @see findPath
             */
            this.printPath = function (source, target) {
                source = _getVertex(source);
                target = _getVertex(target);
                var path = this.findPath(source, target).path;
                var s = "[" + source.id + " - " + target.id + "] : ";
                for (var i = 0; i < path.length; i++)
                    s = s + "{ vertex:" + path[i].vertex.id + ", cost:" + path[i].cost + ", edge: " + (path[i].edge && path[i].edge.getId()) + " } ";
                return s;
            };

            /**
             * Returns the `diameter` of the Graph.
             * @method getDiameter
             * @param {Boolean} [dontUseMax=false] Whether or not to return Infinity if there is at least one pair of nodes for which there is no available path.
             * @return {Number} Diameter of the Graph.
             */
            this.getDiameter = function (dontUseMax) {
                var diameter = 0;
                for (var i = 0; i < self.vertices.length; i++) {
                    for (var j = 0; j < self.vertices.length; j++) {
                        if (j != i) {
                            var info = Djikstra.compute({graph: self, source: self.vertices[i], target: self.vertices[j]});
                            if (info.path == null || info.path.length == 0) {
                                if (!dontUseMax)
                                    return Infinity;
                            }
                            else
                                diameter = Math.max(diameter, info.pathDistance);
                        }
                    }
                }
                return diameter;
            };

            this.diameter = this.getDiameter;

            /**
             * Returns the degree centrality of the given node. This is an alias to `getDegreeCentrality`, as centrality
             * most commonly refers to degree centrality. Note that this returns incoming and outgoing connections; use
             * getIndegreeCentrality or getOutdegreeCentrality if you need to be more specific.
             * @method getCentrality
             * @param {Node|String} node Node, or Node ID, to retrieve centrality for.
             * @return {Integer} Node's centrality.
             * @see getBetweenness
             * @see getCloseness
             */
            this.getCentrality = function (node) {
                node = _getVertex(node);
                return (node.getIndegreeCentrality() + node.getOutdegreeCentrality()) / (self.getVertexCount() - 1);
            };

            this.getDegreeCentrality = this.getCentrality;

            /**
             * Returns the indegree centrality of the given node (number of connections entering the vertex)
             * @method getIndegreeCentrality
             * @param {Node|String} node Node, or Node ID, to retrieve indegree centrality for.
             * @return {Integer} Node's indegree centrality.
             */
            this.getIndegreeCentrality = function (node) {
                node = _getVertex(node);
                return node.getIndegreeCentrality() / (self.getVertexCount() - 1);
            };

            /**
             * Returns the outdegree centrality of the given node (number of connections exiting the vertex)
             * @method getOutdegreeCentrality
             * @param {Node|String} node Node, or Node ID, to retrieve outdegree centrality for.
             * @return {Integer} Node's indegree centrality.
             */
            this.getOutdegreeCentrality = function (node) {
                node = _getVertex(node);
                return node.getOutdegreeCentrality() / (self.getVertexCount() - 1);
            };

            /**
             * Returns the Closeness centrality of the given node. This is the inverse of the node's farness.
             * @method getCloseness
             * @param {Node|String} node Node, or Node ID, to retrieve closeness for.
             * @return {Float} Node's "closeness".
             * @see getFarness
             */
            this.getCloseness = function (node) {
                return 1 / self.getFarness(node);
            };

            /**
             * Returns the farness centrality of the given node, ie. the sum of its distance from all other nodes, where the distance from one Node to another is given by the associated cost of the Edge joining the two Nodes.
             * @method getFarness
             * @param {Node|String} node Node, or Node ID, to retrieve farness for.
             * @return {Number} Node's "farness".
             */
            this.getFarness = function (node) {
                node = _getVertex(node);
                // sum all of its paths to every other node.
                var info = Djikstra.compute({graph: self, source: node, target: node, processAll: true}), total = 0;
                for (var i in info.dist) {
                    total += info.dist[i];
                }
                return total / (self.getVertexCount() - 1);
            };

            /**
             * Returns the betweenness centrality of the given node.
             * @method getBetweenness
             * @param {Node|String} node Node, or Node ID, to retrieve betweenness centrality for.
             * @return {Float} Node's "betweenness" centrality.
             */
            this.getBetweenness = function (node) {

                var n = self.getVertexCount(),
                    denominator = (n - 1) * (n - 2) / 2,
                    betweenness = 0,
                    totalPathsThroughFocus = 0,
                    processNode = function (source, target, info, pathFromTarget, paths) {
                        var parents = info.parents[source][target];
                        if (parents.length == 0) {
                            var p = pathFromTarget.slice();
                            p.unshift(source);
                            paths.push(p);
                        }
                        else {
                            for (var i = 0; i < parents.length; i++) {
                                if (pathFromTarget.indexOf(parents[i][0].id) == -1) {
                                    var p = pathFromTarget.slice();
                                    p.unshift(parents[i][0].id);
                                    processNode(source, parents[i][0].id, info, p, paths);
                                }
                            }
                        }
                    };

                node = _getVertex(node);
                var info = FloydWarshall.compute({graph: self, focus: node});

                // for each node pair, retrieve the actual paths.  there may be multiple shortest paths for one given node
                // pair, and we use the 'parents' array to help with this. its a 2d array containing null for [v1,v1],
                // and an array of N entries for every [v1,vX]. N may be zero, which indicates that vN is adjacent to
                // v1. if it is greater than zero then it tells you how many nodes adjacent to vN are on shortest paths,
                // but note that it _does not_ tell you how many shortest paths join to vN.  we have to recurse back from
                // vN to each parent in this array, and look at that parent's entry; it will also be an array of N entries where
                // N may be zero or more.  we recurse up this parent array until we hit the trivial case - that N = 0.
                // as we go up the tree we can compare each node to see if it is the node for which we are computing
                // betweenness. remember that it only counts if the node is on the path, not the source or target.

                for (var v1 in info.paths) {
                    for (var v2 in info.paths[v1]) {
                        // v1 and v2 are the ids of our two nodes
                        if (v1 != v2) {
                            var pathsForPair = [], pathsUsingFocusNode = 0;
                            processNode(v1, v2, info, [v2], pathsForPair);
                            for (var i = 0; i < pathsForPair.length; i++) {
                                var idx = pathsForPair[i].indexOf(node.id);
                                if (idx > 0 && idx < pathsForPair[i].length - 1)
                                    pathsUsingFocusNode++;
                            }
                            betweenness += (pathsUsingFocusNode / pathsForPair.length);
                            totalPathsThroughFocus += pathsUsingFocusNode;
                        }
                    }
                }
                return betweenness / denominator;
            };

            // Helper method to dump the contents of the Graph to a string.
            this.inspect = function () {
                var r = "";
                for (var i = 0; i < self.vertices.length; i++)
                    r += self.vertices[i].inspect() + "\n";

                return r;
            };


            this.serialize = function () {
                var out = { nodes: [], edges: [], ports: [] };
                for (var i = 0; i < self.vertices.length; i++) {
                    var n = self.vertices[i];
                    out.nodes.push(n.data);
                    var e = n.getAllEdges(), p = n.getPorts();
                    for (var j = 0; j < e.length; j++) {
                        if (e[j].source == n || (e[j].source.objectType === "Port" && e[j].source.getNode() == n)) {
                            var ee = {
                                source: e[j].source.getFullId(),
                                target: e[j].target.getFullId()
                            };

                            if (e[j].data)
                                ee.data = e[j].data;

                            out.edges.push(ee)
                        }
                    }
                    for (var l = 0; l < p.length; l++) {
                        var le = { };

                        for (var m in p[l].data)
                            le[m] = p[l].data[m];

                        le.id = p[l].getFullId();

                        out.ports.push(le);
                    }
                }

                return out;
            };
        },

        /**
         finds the Vertex in the 'dist' table that has not yet been computed and has the smallest cost so far.
         */
        _findSmallestDist = function (vertices, usedVertices, dist, idFunc, _getDist) {
            var idx = -1, node = null, smallest = Infinity;
            for (var i = 0; i < vertices.length; i++) {
                if (!usedVertices[i]) {
                    var d = _getDist(vertices[i]);
                    if (d < smallest) {
                        smallest = d;
                        idx = i;
                        node = vertices[i];
                    }
                }
            }
            return {node: node, index: idx};
        },

        _findPrev = function(previous, obj) {
           var id = obj.getFullId(), p = previous[id];
            if (p == null) {
                id = obj.getNode ? obj.getNode().id : obj.id;
                p = previous[id];
            }
            return p == null ? null : { p:p, id:id };
        },

        /**
         assembles a path to the given target, using data from the 'dist' and 'previous' tables.  the source of the path is the source that was most recently passed in to the
         Djikstra.compute method.
         */
        _findPath = function (dist, previous, edges, target, idFunc, strict) {
            var path = [], u = target;//, uid = idFunc(u);
            var p = _findPrev(previous, u);
            while (p != null) {
                path.splice(0, 0, {vertex: u, cost: dist[p.id], edge: edges[p.id]});
                u = p.p;
                //uid = idFunc(u);
                p = _findPrev(previous, u);
                //uid = u.getNode ? u.getNode().id : u.id;
            }
            // insert start vertex.
            path.splice(0, 0, {vertex: u, cost: 0, edge: null});
            return path;
        },

    // http://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm
    /*
     Assume a function edgeCost(i,j) which returns the cost of the edge from i to j
     (infinity if there is none).
     Also assume that n is the number of vertices and edgeCost(i,i) = 0


     int path[][];
     A 2-dimensional matrix. At each step in the algorithm, path[i][j] is the shortest path
     from i to j using intermediate vertices (1..k−1).  Each path[i][j] is initialized to
     edgeCost(i,j).


     procedure FloydWarshall ()
     for k := 1 to n
     for i := 1 to n
     for j := 1 to n
     path[i][j] = min ( path[i][j], path[i][k]+path[k][j] );
     */
        FloydWarshall = {
            getPath: function (pathInfo, nextInfo, source, target) {
                if (pathInfo[source.id][target.id] == Infinity)
                    return null;
                var intermediate = nextInfo[source.id][target.id];
                if (intermediate == null)
                    return " ";   //there is an edge from i to j, with no vertices between
                else
                    return FloydWarshall.getPath(pathInfo, nextInfo, source, intermediate) + " " + intermediate.id + " " + FloydWarshall.getPath(pathInfo, nextInfo, intermediate, target);
            },
            getPaths: function (pathInfo, nextInfo, source, target, paths) {
                if (pathInfo[source.id][target.id] == Infinity)
                    return null;
                var intermediate = nextInfo[source.id][target.id];
                if (intermediate.length == 0)
                    return " ";   // there is an edge from i to j, with no vertices between
                else
                    return FloydWarshall.getPaths(pathInfo, nextInfo, source, intermediate[0]) + " " + intermediate[0].id + " " + FloydWarshall.getPaths(pathInfo, nextInfo, intermediate[0], target);
            },
            compute: function (params) {
                var graph = params.graph,
                    n = graph.getVertexCount(),
                    path = {},
                    next = {}, i, j, k;

                // init
                for (i = 0; i < n; i++) {
                    var v = graph.getVertexAt(i);
                    if (!path[v.id]) path[v.id] = {};
                    if (!next[v.id]) next[v.id] = {};
                    path[v.id][v.id] = 0;
                    for (j = 0; j < n; j++) {
                        if (i != j) {
                            var v2 = graph.getVertexAt(j);
                            if (!path[v.id][v2.id]) path[v.id][v2.id] = Infinity;
                            if (!next[v.id][v2.id]) next[v.id][v2.id] = [];
                        }
                    }
                    var edges = v.getEdges();
                    for (k = 0; k < edges.length; k++) {
                        if (edges[k].source == v) {
                            path[v.id][edges[k].target.id] = edges[k].getCost();
                        }
                        else {
                            if (!path[edges[k].source.id]) {
                                path[edges[k].source.id] = {};
                                next[edges[k].source.id] = {};
                            }
                            path[v.id][edges[k].source.id] = edges[k].getCost();
                        }
                    }
                }
                //
                for (k = 0; k < n; k++) {
                    for (i = 0; i < n; i++) {
                        for (j = 0; j < n; j++) {
                            if (i != j && j != k && i != k) {
                                var id1 = graph.getVertexAt(i).id, id2 = graph.getVertexAt(j).id, id3 = graph.getVertexAt(k).id;
                                if ((path[id1][id3] + path[id3][id2]) <= path[id1][id2] && (path[id1][id3] + path[id3][id2]) != Infinity) {
                                    path[id1][id2] = path[id1][id3] + path[id3][id2];
                                    if (!next[id1][id2]) next[id1][id2] = [];
                                    next[id1][id2].unshift([graph.getVertexAt(k), path[id1][id2]]);
                                }
                            }
                        }
                    }
                }

                //return [ path, pathsThroughFocus ];
                return {paths: path, parents: next};
            }
        },
        /**
         * An implementation of the Djikstra shortest path algorithm. The algorithm has been modified
         * slightly to handle Ports on Nodes.
         */
        Djikstra = {
            compute: function (params) {
                var graph = params.graph,
                    source = params.source,
                    target = params.target,
                    nodeFilter = params.nodeFilter,
                    edgeFilter = params.edgeFilter,
                    dist = {},
                    previous = {},
                    edges = {},
                    retVal = { dist: dist, previous: previous, edges: edges, path: [] },
                    processAll = params.processAll,
                    portMap = {},
                    nodeFromPortMap = {},
                    strict = !(params.strict === false),
                    _getId = function (n) {
                        return n.getFullId ? n.getFullId() : n.id;
                    },
                    _vertices = [],
                    _getRelatedPorts = function (p) {
                        var n = nodeFromPortMap[p.getFullId()];
                        return portMap[n.v.id];
                    },
                    _setDist = function (o, v) {
                        var pp, i;
                        // if o is a node, v is applied to all ports also. otherwise, all other ports
                        // for the node that is the parent of o are given v + internalEdgeCost, which may
                        // vary by port.
                        if (o.objectType === "Port") {
                            dist[o.getFullId()] = v;
                            // it's a port.
                            pp = _getRelatedPorts(o);
                            for (i = 0; i < pp.length; i++) {
                                if (pp[i].p != o) {
                                    dist[pp[i].p.getFullId()] = v + o.getNode().getInternalEdge(o, pp[i].p).cost;
                                }
                            }

                            if (!strict)
                                dist[o.getNode().id] = v;
                        }
                        else {
                            dist[o.id] = v;
                            pp = portMap[o.id];
                            for (i = 0; i < pp.length; i++)
                                dist[pp[i].p.getFullId()] = v;
                        }
                    },
                    _getDist = function (o) {
                        if (nodeFilter && !nodeFilter(o)) return Infinity;
                        return dist[_getId(o)];
                    },
                    _setPrevious = function (n, nId, prevInfo) {
                        if (n.objectType === "Port") {
                            var pp = _getRelatedPorts(n);
                            for (var i = 0; i < pp.length; i++) {
                                previous[pp[i].p.getFullId()] = prevInfo.node;
                            }

                            if (!strict)
                                previous[n.getNode().id] = prevInfo.node;
                        }
                        previous[nId] = prevInfo.node;
                    },
                    _setEdge = function (n, nId, edge) {
                        if (n.objectType === "Port") {
                            var pp = _getRelatedPorts(n);
                            for (var i = 0; i < pp.length; i++) {
                                edges[pp[i].p.getFullId()] = edge;
                            }

                            if (!strict)
                                edges[n.getNode().id] = edge;
                        }
                        edges[nId] = edge;
                    };

                for (var i = 0; i < graph.vertices.length; i++) {
                    var v = graph.vertices[i], p = v.getPorts();
                    _vertices.push(v);
                    var nodeData = {v: v, i: _vertices.length - 1};
                    portMap[v.id] = [];
                    _setDist(v, Infinity);

                    for (var j = 0; j < p.length; j++) {
                        _vertices.push(p[j]);
                        nodeFromPortMap[p[j].getFullId()] = nodeData;
                        portMap[v.id].push({p: p[j], i: _vertices.length - 1});
                        _setDist(p[j], Infinity);
                    }
                }

                if (source == null) source = graph.getVertex(params.sourceId);
                if (target == null) target = graph.getVertex(params.targetId);
                if (source == null || target == null) return retVal;
                // save the nodes. source/target might be a port.
                var sourceNode = source, targetNode = target;
                // if source and/or target is a port, get the underlying Node.
                if (source.getNode) sourceNode = source.getNode();
                if (target.getNode) targetNode = target.getNode();

                _setDist(source, 0);

                var completedNodes = new Array(graph.vertices.length),
                    completed = 0,
                    processEdges = function (nodeInfo, _edges, edgeSelector, neighbourSelector) {
                        for (var i = 0; i < _edges.length; i++) {
                            var edge = _edges[i];
                            if (edgeSelector(edge)) {

                                var neighbour = neighbourSelector(edge),
                                    neighbourObject = neighbour.tp || neighbour.tn,
                                    nid = _getId(neighbourObject);

                                var alt = _getDist(nodeInfo.node) + edge.getCost(),
                                    d = _getDist(neighbourObject);

                                if (alt < d) {
                                    _setDist(neighbourObject, alt);
                                    _setPrevious(neighbourObject, nid, nodeInfo);
                                    _setEdge(neighbourObject, nid, edge);
                                }
                            }
                        }
                    };

                while (completed < _vertices.length) {
                    var curNodeInfo = _findSmallestDist(_vertices, completedNodes, dist, _getId, _getDist),
                        curObjectId = curNodeInfo.node ? _getId(curNodeInfo.node) : null;

                    if (!curNodeInfo.node || _getDist(curNodeInfo.node) == Infinity) break;

                    if (target && (curObjectId == _getId(target) || (!strict && curNodeInfo.node.isChildOf && curNodeInfo.node.isChildOf(target)))) {
                        retVal.path = _findPath(dist, previous, edges, target, _getId);
                        retVal.pathDistance = retVal.path[retVal.path.length - 1].cost;
                        if (!processAll) break;
                    }
                    completedNodes[curNodeInfo.index] = true;
                    completed = completed + 1;
                    // here we get all edges for the node - port and all, and the edge selector function
                    // filters out edges for which this node is not the source. It also uses the current
                    // edgeFilter function, if one is set.
                    processEdges(curNodeInfo, curNodeInfo.node.getAllEdges(),
                        function (e) {
                            if (edgeFilter && !edgeFilter(e)) return false;
                            return !e.isDirected() ||
                                (curNodeInfo.node == e.source) ||
                                (!strict && e.source.isChildOf && e.source.isChildOf(curNodeInfo.node));
                        },
                        // this is the neighbourSelector for some edge. it returns [targetNode, targetPort]
                        // if the current node/port is the source, or source info otherwise.
                        function (e) {
                            var sn = e.source.getNode ? e.source.getNode() : e.source,
                                sp = e.source.getNode ? e.source : null,
                                tn = e.target.getNode ? e.target.getNode() : e.target,
                                tp = e.target.getNode ? e.target : null;

                            return (e.source == curNodeInfo.node || (!strict && e.source.isChildOf && e.source.isChildOf(curNodeInfo.node))) ? {tn: tn, tp: tp} : {tn: sn, tp: sp};
                        });
                }
                // the shortcut exit does not get here; this function returns two different types of value!
                return retVal;
            }
        };


}).call(this);

/*
 * jsPlumbToolkit
 * copyright 2014 jsPlumb
 * http://jsplumbtoolkit.com
 *
 * Licensed under the GPL2 license.  This software is not free.
 *
 * @desc Higher level functionality built on top of jsPlumb.  This script provides various layout/ui generation
 * algorithms such as tree generation, force directed graph layout, shortest path calculations, animations etc.
 *
 */

;
(function () {

    "use strict";

    var root = this;
    var JUTIL = jsPlumbUtil;
    var UTIL = jsPlumbToolkitUtil;

    var // This is the default function the jsPlumb Toolkit will use to derive an ID for some piece of JSON representing a node.  It looks
    //for an 'id' member in the JSON.
        _defaultGetId = function (data) {
            return data.id;
        },
    // This is the default function the jsPlumb Toolkit will use to derive a type for some piece of JSON representing a node.  It looks
    // for a 'type' member in the JSON.
        _defaultGetType = function (data) {
            return data.type || "default";
        };


    /**
     * An instance of the jsPlumb Toolkit.  Each instance is backed by a `Graph`, and has zero or more `Renderer`s attached.
     *
     * #### Creating an instance
     * You create an instance of the jsPlumb Toolkit via the static method `jsPlumbToolkit.newInstance(params)`. The contents of `params` are
     * any valid constructor parameters as detailed here.
     * #### Rendering data
     * An instance of the jsPlumb Toolkit does not itself handle rendering the data to your UI; to do that, you must call the `render`
     * method of your Toolkit instance:
     * ```
     * var myToolkit = jsPlumbToolkit.newInstance();
     * var aRenderer = myToolkit.render({
     *   container:"someElementId",
     *   ...other params, possibly..
     * });
     * ```
     * #### Operating on the dataset
     * In general, you will operate on the dataset via the `jsPlumbToolkitInstance` object, because any attached `Renderers` will
     * for the most part sort themselves out based on the data model. Occasionally you will want to perform some view-specific
     * operation such as highlighting a Path, or hiding some Nodes, etc.  These sorts of operations are executed on the
     * `Renderer` and not on the Toolkit object.
     *
     * @class jsPlumbToolkitInstance
     * @constructor
     * @param {Object} params Constructor parameters
     * @param {Function} [params.idFunction] Optional function to use to extract an id from a Node's data. The default
     * is to retrieve the `id` property.
     * @param {Function} [params.typeFunction] Optional function to use to extract a type identifier from a Node's data.
     * The default is to retrieve the `type` property.
     * @param {Function} [params.edgeIdFunction] Optional function to use to extract an id from an Edge's data. The
     * default is to retrieve the `id` property.
     * @param {Function} [params.portIdFunction] Optional function to use to extract an id from a Port's data. The
     * default is to retrieve the `id` property.
     * @param {Function} [params.portTypeFunction] Optional function to use to extract a type identifier from a Port's
     * data. The default is to retrieve the `type` property.
     * @param {Object} [params.model] Model of Node, Edge and Port definitions.  See documentation.
     * @param {Function} [params.beforeConnect] Optional function that will be called prior to any edge being
     * established (either programmatically or via the mouse). It is passed the (source, target) of the proposed edge
     * and if it returns anything other than boolean true, the edge is aborted.
     * If not supplied, the default behaviour of this function is to honor the `allowLoopback`, `allowNodeLoopback`
     * and `maxConnections` parameters on any Node or Port definitions you supplied to this Toolkit via the `model`.
     * @param {Function} [params.beforeMoveConnection] Optional function that will be called prior to any existing edge
     * being moved (either programmatically or via the mouse). It is passed the source and target of the existing edge,
     * as well as the edge itself, and if it returns anything other than boolean true, the edge move is aborted.
     * If not supplied, the default behaviour of this function is to honor the `allowLoopback`, `allowNodeLoopback` and
     * `maxConnections` parameters on any Node or Port definitions you supplied to this Toolkit via the `model`.
     * @param {Function} [params.beforeStartConnect] Optional function that will be called prior to an edge being
     * established. This is different from `beforeConnect` in that this function is called right at the beginning of a
     * connection drag by attached renderers, and the function is given the node/port that is the source, plus the edge
     * type. If you return false the Edge is aborted. Otherwise your return value is used as the Edge data.
     * @param {Function} [params.beforeDetach] Optional function that can be used to override connection detachment from
     * the mouse. The function is given (source, target, edge) and is expected to return true to confirm the detach
     * should occur. Any other return value will abort the detach.
     * @param {Function} [params.beforeStartDetach] Optional function that can be used to override connection detachment
     * from the mouse. Distinct from `beforeDetach` in that this function is called as soon as the user begins to drag.
     * The function is given (source, target, edge) and is expected to return true to confirm the detach should occur.
     * Any other return value will abort the detach.
     * @param {Function} [params.nodeFactory] Function to use to generate data for a new Node. Default is to create an
     * object with an `id` property.
     * @param {Function} [params.edgeFactory] Function to use to generate data for a new Edge. Default is to create an
     * object with an `id` property.
     * @param {Function} [params.portFactory] Function to use to generate data for a new Port. Default is to create an
     * object with an `id` property.
     * @param {Function} [params.portExtractor] Optional function to call whenever a Node is added; it extracts, from
     * the Node's data, any Ports that are associated with the Node.
     * @param {Boolean} [params.autoSave=false] Whether or not to automatically save the dataset when changes occur. You
     * must supply the `saveUrl` property if you set this to true.
     * @param {String} [params.saveUrl] Url to use when saving automatically.
     * @param {Function} [params.onAutoSaveSuccess] Optional function to call on autoSave success.
     * @param {Function} [params.onAutoSaveError] Optional function to call on autoSave error.
     * @param {Boolean} [params.doNotUpdateOriginalData=false] If true, won't try to update the original data when a
     * Node/Edge is removed.
     * @param {Integer} [params.maxSelectedEdges] Optional limit for the number of edges allowed to be selected at any
     * one time.
     * @param {Integer} [params.maxSelectedNodes] Optional limit for the number of nodes allowed to be selected at any
     * one time.
     * @param {Integer} [params.selectionCapacityPolicy] Optional selection capacity policy. See
     * `setSelectionCapacityPolicy` docs.
     */
    root.jsPlumbToolkitInstance = function (params) {

        params = params || {};

        var _idFunction = params.idFunction || _defaultGetId,
            _typeFunction = params.typeFunction || _defaultGetType,
            _edgeIdFunction = params.edgeIdFunction || _idFunction,
            _edgeTypeFunction = params.edgeTypeFunction || _typeFunction,
            _portIdFunction = params.portIdFunction || _idFunction,
            _portTypeFunction = params.portTypeFunction || _typeFunction,
            _portExtractor = params.portExtractor,
            _currentInstance = this,
            _suspendGraph = false,
            debugEnabled = false,
            _model = params.model || {},
            _defaultObjectFactory = function (type, data, callback) {
                data = data == null || !JUTIL.isObject(data) ? {} : data;
                data = JUTIL.clone(data);
                data.id = data.id || UTIL.uuid();
                data.type = data.type || type;
                callback(data);
            },
            _nodeFactory = params.nodeFactory || _defaultObjectFactory,
            _edgeFactory = params.edgeFactory || _defaultObjectFactory,
            _portFactory = params.portFactory || _defaultObjectFactory,
            autoSave = params.autoSave && params.saveUrl,
            saveUrl = params.saveUrl,
            onAutoSaveSuccess = params.onAutoSaveSuccess || function () {
            },
            onAutoSaveError = params.onAutoSaveError || function () {
            },
            doNotUpdateOriginalData = params.doNotUpdateOriginalData === true,
            graphParams = {
                portSeparator: params.portSeparator,
                defaultCost: params.defaultCost,
                defaultDirected: params.defaultDirected,
                enableSubgraphs: params.enableSubgraphs
            };

        JUTIL.EventGenerator.apply(this, arguments);
        var _graph = new jsPlumbGraph.Graph(graphParams);
        if (autoSave)
            new UTIL.AutoSaver(this, saveUrl, onAutoSaveSuccess, onAutoSaveError);

        // catch all event handler fires 'dataUpdated' for lots of events.
        new UTIL.CatchAllEventHandler(this);

        /**
         * Gets the current NodeFactory.
         * @return {Function} Current Node Factory; see documentation for a discussion.
         */
        this.getNodeFactory = function () {
            return _nodeFactory;
        };
        /**
         * Gets the current EdgeFactory.
         * @return {Function} Current Edge Factory; see documentation for a discussion.
         */
        this.getEdgeFactory = function () {
            return _edgeFactory;
        };
        /**
         * Gets the current PortFactory.
         * @method getPortFactory
         * @return {Function} Current Port Factory; see documentation for a discussion.
         */
        this.getPortFactory = function () {
            return _portFactory;
        };
        /**
         * Sets the current NodeFactory.
         * @method setNodeFactory
         * @param {Function} f Node factory to set as current.
         * @return {Function} Node Factory to use; see documentation for a discussion.
         */
        this.setNodeFactory = function (f) {
            _nodeFactory = f;
        };
        /**
         * Sets the current EdgeFactory.
         * @return {Function} Edge Factory to use; see documentation for a discussion.
         */
        this.setEdgeFactory = function (f) {
            _edgeFactory = f;
        };
        /**
         * Sets the current PortFactory.
         * @return {Function} Port Factory to use; see documentation for a discussion.
         */
        this.setPortFactory = function (f) {
            _portFactory = f;
        };

        this.setDebugEnabled = function (d) {
            debugEnabled = d;
        };
        this.isDebugEnabled = function () {
            return debugEnabled;
        };

        /**
         * Gets the model registered with this Toolkit instance, if any. Models may be registered on the Toolkit or on each individual
         * Surface. In general it is a good idea to use the Toolkit's model to map data model event handlers and other data model considerations
         * such as the maximum number of connections a Port allows, and each Surface's model definition to configure view concerns.
         * @method getModel
         * @return {Object} Current model. May be null.
         */
        this.getModel = function () {
            return _model || {};
        };

        var _internalModel, _getModel = function() {
            if (_internalModel == null)
                _internalModel = new jsPlumbToolkit.Model(_model || {});
            return _internalModel;
        };

        var _defaultConnectHandler = function(source, target) {
            if (_model == null) return true; // shortcut for setups where there is no model on the toolkit.
            var st = this.getType(source), tt = this.getType(target),
                p = _getModel(),
                sn = source.getNode ? source.getNode() : source,
                tn = target.getNode ? target.getNode() : target,
                sd = source.objectType == "Node" ? p.getNodeDefinition(st) : p.getPortDefinition(st),
                td = target.objectType == "Node" ? p.getNodeDefinition(tt) : p.getPortDefinition(tt),
                snt = this.getNodeType(sn),
                tnt = this.getNodeType(tn),
                snd = p.getNodeDefinition(snt),
                tnd = p.getNodeDefinition(tnt);

            // maxConnections
            if (sd.maxConnections != null) {
                if (source.getEdges().length >= sd.maxConnections) return false;
            }

            if (td.maxConnections != null) {
                if (target.getEdges().length >= td.maxConnections) return false;
            }

            // it's loopback if the source is the same as the target (whether they be nodes or ports).
            if (source == target) {
                return !(snd.allowLoopback === false || sd.allowLoopback === false|| td.allowLoopback === false || tnd.allowLoopback === false);
            }

            // it's nodeLoopback if the source node is the same as the target node.
            if (sn == tn) {
                return !(snd.allowNodeLoopback === false|| sd.allowNodeLoopback === false || td.allowNodeLoopback === false || tnd.allowNodeLoopback === false);
            }

            return true;
        }.bind(this);

        this.beforeConnect = params.beforeConnect || _defaultConnectHandler;
        this.beforeMoveConnection = params.beforeMoveConnection || _defaultConnectHandler;

        this.beforeStartConnect = params.beforeStartConnect || function(obj, edgeType) {
            return { };
        };

        this.beforeDetach = params.beforeDetach || function(source, target, edge) {
            return true;
        };

        this.beforeStartDetach = params.beforeStartDetach || function(nodeOrPort, edge) {
            return true;
        };

        this.setSuspendGraph = function (v) {
            _suspendGraph = v;
        };

        /**
         * Sets whether or not the original dataset will be updated whenever a node/edge is removed or added. This functionality is suspended
         * when a `load` operation is taking place. Note that for this functionality to work there must be a `manager` registered for the given
         * data type in jsPlumbToolkitIO. The Toolkit ships with a manager for the default `json` datatype, but if you have your own custom
         * datatype you will need to provide one of these to support this functionality. See the documentation on data loading for a full
         * discussion.
         * @param {Boolean} update True if you want the backing data to be updated, false otherwise.
         */
        this.setDoNotUpdateOriginalData = function (update) {
            doNotUpdateOriginalData = update;
        };

        /**
         * Returns the type function that is currently in use.
         * @return {Function} Function currently being used to determine types of nodes from their data. The default is to look for a `type` member in the data.
         */
        this.getTypeFunction = function () {
            return _typeFunction;
        };

        /**
         * Connects two nodes/ports (or a combination of the two), by ID.  This function does not know about the DOM: tou cannot pass it DOM elements
         * or selectors. By default, this method will create nodes that are missing. Port ids are specified with a dotted syntax, eg `foo.bar` refers
         * to the port "bar" on the node "foo".
         * @method connect
         * @param {Object} params Connect parameters.
         * @param {Object|String} params.source Either the data for a node, or a node id as a string, representing the source node in the connection.
         * @param {Object|String} params.target Either the data for a node, or a node id as a string, representing the target node in the connection
         * @param {Number} [params.cost=1] Optional; the cost of the connection.
         * @param {Boolean} [params.directed=false] Optional, defaults to false. Whether the edge is directed.
         * @param {Boolean} [params.doNotCreateMissingNodes=false] Optional, defaults to false. Whether to NOT create nodes that do not exist yet. Sorry about the double negative.
         * @param {Object} [params.data] Optional backing data for the Edge. Here you might like to set id:'some value' if you need o retrieve the Edge by id later on.
         * @return {Edge} The new Edge.
         */
        this.connect = function (params) {
            params = params || {};
            var edge;
            if (!_suspendGraph) {
                var sv = _graph.getVertex(params.source),
                    tv = _graph.getVertex(params.target),
                    cost = params.cost,
                    directed = params.directed;

                if (!sv) {
                    if (!params.doNotCreateMissingNodes) {
                        sv = _graph.addVertex(params.source);
                        _currentInstance.fire("nodeAdded", { data: {}, node: sv });
                    }
                    else
                        return;  // probaby better to throw here? but maybe not.
                }

                if (!tv) {
                    if (!params.doNotCreateMissingNodes) {
                        tv = _graph.addVertex(params.target);
                        _currentInstance.fire("nodeAdded", { data: {}, node: tv });
                    }
                    else
                        return;
                }

                var _continue = this.beforeStartConnect(sv, _edgeTypeFunction(params.data || {}));
                if (_continue) {
                    var data = params.data || {};
                    if (typeof _continue === "object") jsPlumb.extend(data, _continue);
                    var _reallyContinue = this.beforeConnect(sv, tv, data);
                    if (_reallyContinue !== false) {
                        edge = _graph.addEdge({source: sv, target: tv, cost: cost, directed: directed, data: data});
                        _currentInstance.fire("edgeAdded", {edge: edge});
                    }
                }
            }

            return edge;
        };

        /**
         * Clears the graph, then fires a `graphCleared` event.
         * @method clear
         * @return {jsPlumbToolkitInstance} The current Toolkit instance.
         */
        this.clear = function () {
            _graph.clear();
            this.fire("graphCleared");
            return this;
        };

        /**
         * Returns the current Graph.
         * @method getGraph
         * @return {Graph} The underlying Graph.
         */
        this.getGraph = function () {
            return _graph;
        };

        /**
         * Returns the count of nodes in the Graph.
         * @method getNodeCount
         * @return {Number} The count of Nodes in the Graph.
         */
        this.getNodeCount = function () {
            return _graph.getVertexCount();
        };

        /**
         * Returns the Node at the given index.
         * @method getNodeAt
         * @return {Object} The Node at the given index, null if not found.
         */
        this.getNodeAt = function (idx) {
            return _graph.getVertexAt(idx);
        };

        /**
         * Returns all the nodes in the Graph.
         * @method getNodes
         * @return {Node[]} All the Nodes in the graph.
         */
        this.getNodes = function () {
            return _graph.getVertices();
        };

        /**
         * Iterates through all Nodes in the Toolkit one at a time. You should not perform destructive editing of
         * the dataset inside one of these loops.
         * @method eachNode
         * @param {Function} fn A function that takes (index, node) as arguments and is applied for every Node in the Toolkit instance.
         */
        this.eachNode = function (fn) {
            for (var i = 0, j = _graph.getVertexCount(); i < j; i++) {
                fn(i, _graph.getVertexAt(i));
            }
        };

        /**
         * Iterates through all Edges in the Toolkit one at a time. You should not perform destructive editing of
         * the dataset inside one of these loops.
         * @method eachEdge
         * @param {Function} fn A function that takes (index, edge) as arguments and is applied for every Node in the Toolkit instance.
         */
        this.eachEdge = function (fn) {
            var e = _graph.getEdges();
            for (var i = 0, j = e.length; i < j; i++) {
                fn(i, e[i]);
            }
        };

        /**
         * Returns the total number of Edges.
         * @method getEdgeCount
         * @return {Number} The total number of Edges in the Graph.
         */
        this.getEdgeCount = function () {
            return _graph.getEdgeCount();
        };

        /**
         * Gets the id of the Node represented by the given arguments. If this is a JS object, we extract the id using the
         * current idFunction. Otherwise we just pass it back as-is.
         * @method getNodeId
         * @param {Object} node Object from which to retrieve id.
         * @return {String} The Node's id, if the current idFunction was able to resolve it, or the given object.
         */
        this.getNodeId = function (node) {
            return JUTIL.isObject(node) ? _idFunction(node) : node;
        };


        /**
         * Gets the type of the Node represented by the given JS object. We first try for a return value from the current typeFunction,
         * but if that returns nothing we just return 'default'.
         * @method getNodeType
         * @param {Object} node Object from which to derive type.
         * @return {String} Either the object's type, or `default`.
         */
        this.getNodeType = function (node) {
            return _typeFunction(node) || "default";
        };

        /**
         * Gets the id of the Edge represented by the given arguments. If this is a JS object, we extract the id using the
         * current edgeIdFunction. Otherwise we just pass it back as-is.
         * @method getEdgeId
         * @param {Object} edge Edge from which to retrieve id.
         * @return {String} Edge's id, if we could resolve it, otherwise the object we were given.
         */
        this.getEdgeId = function (edge) {
            return JUTIL.isObject(edge) ? _edgeIdFunction(edge) : edge;
        };

        /**
         * Gets the type of the Edge represented by the given JS object.
         * @method getEdgeType
         * @return {String} Either the Edge's type, if set, or "default".
         */
        this.getEdgeType = function (edge) {
            return _edgeTypeFunction(edge) || "default";
        };

        /**
         * Gets the id of the Port represented by the given arguments. If this is a JS object, we extract the id using the
         * current portIdFunction. Otherwise we just pass it back as-is.
         * @method getPortId
         * @return {String} Port's id, if we could resolve it, otherwise the object we were given.
         */
        this.getPortId = function (port) {
            return JUTIL.isObject(port) ? _portIdFunction(port) : port;
        };

        /**
         * Gets the type of the Port represented by the given JS object
         * @method getPortType
         * @return {String} Either the port's type, if set, or "default".
         */
        this.getPortType = function (port) {
            return _portTypeFunction(port) || "default";
        };

        /**
         * Gets the type of the given Object. This is not a type such as `Node`, `Port` or `Edge` - this is the type of the
         * object as defined by your system to identify types; these are the types used to lookup objects in the model.
         * @param obj
         * @returns {String} The object's type.
         */
        this.getType = function(obj) {
            var m = obj.objectType === "Node" ? _typeFunction : obj.objectType === "Port" ? _portTypeFunction : _edgeTypeFunction;
            return m(obj.data) || "default";
        };

        /**
         * Adds a Node with the given data. If the data is null, the Toolkit creates an empty object and assigns
         * a uuid as the Node's id.  If no id can be derived for the given data, the Toolkit creates a uuid and
         * sets it as the data object's 'id' member. This method also calls the current `portExtractor` function, if
         * one was supplied. Its purpose is to extract any Ports from the data for some given Node.
         * @method addNode
         * @param {Object} data The Node's backing data - from your data model.
         * @param {Object} [eventInfo] Optional data member that the Toolkit will pass into any registered event listeners. This can be used
         * by the UI layer, for instance, to track the position on screen of any newly added elements.
         * @return {Node} A Node object.  Your original data is available via the `data` member. The Node's id is available via the `id` member.
         */
        this.addNode = function (data, eventInfo, doNotFireEvent) {
            var id = _idFunction(data);
            // assign an id if one was not supplied.
            if (id == null && (typeof data) !== "string") {
                data.id = UTIL.uuid();
            }

            var v = _graph.addNode(data, _idFunction);
            if (v != null) {

                if (_portExtractor != null) {
                    var ports = _portExtractor(v.data, v);
                    if (ports != null) {
                        for (var i = 0; i < ports.length; i++)
                            v.addPort(ports[i]);
                    }
                }

                if (!_dataLoading && !doNotUpdateOriginalData)
                    root.jsPlumbToolkitIO.manage("addNode", _originalData, _originalDataType, v, _idFunction || _graph.getIdFunction(), _currentInstance);

                // if not null, it didnt exist. fire event and return. Pass in the optional eventInfo params here to the listener.
                if (!doNotFireEvent) {
                    _currentInstance.fire("nodeAdded", {data: data, node: v, eventInfo: eventInfo});
                }

                return v;
            }
            else
            // otherwise get the existing node.
                return _graph.getNode(id);
        };

        /**
         * Adds a Node by type, running the data generation for the node through the current NodeFactory.  This is
         * different from `addNode` in that with `addNode` you are supplying the final data and your NodeFactory is
         * not called. This method can be called with one, two or three arguments. A single argument is considered to be
         * the new Node's `type`, and a backing data object will be created with this set, and no callback will occur.
         * If you provide two arguments the second argument may be either the new Node's backing data OR a callback to
         * hit with the newly created Node. With three arguments the second argument is the Node's backing data and the
         * third is a callback to hit with the newly created Node.
         * @param {String} type Required. Type of the object to create. `type` will be passed as the first argument to your node factory.
         * @param {Object} data Optional backing data for the Node.
         * @param {Function} callback Optional function to call with the newly created Node.
         */
        this.addFactoryNode = function(type, data, callback) {
            data = arguments.length == 2 && (arguments[1] == null || typeof arguments[1] === "object") ? arguments[1]: {};
            callback = arguments.length == 3 ? arguments[2] : typeof arguments[1] == "function" ? arguments[1] : null;
            data.type = data.type || type;
            _nodeFactory(type, data, function(n) {
                var node = this.addNode(n);
                if (callback) { callback(node); }
            }.bind(this));
        };

        /**
         * Adds a list of Nodes.
         * @method addNodes
         * @param {Array} nodeList An array of objects, one for each Node to be added.
         * @return {jsPlumbToolkitInstance} The current Toolkit instance.
         */
        this.addNodes = function (nodeList) {
            for (var i = 0; i < nodeList.length; i++) {
                _currentInstance.addNode.apply(_currentInstance, [ nodeList[i] ]);
            }
            return _currentInstance;
        };

        /**
         * Gets a Node by id, or if the given object is already a Node, hands that back.
         * @method getNode
         * @param {String} nodeId ID of the Node to retrieve.
         * @return {Node} The requested Node, if found, otherwise null.
         */
        this.getNode = function (nodeId) {
            return _graph.getVertex(nodeId);
        };

        /**
         * Gets an Edge by id, or if the given object is already an Edge, hands that back.
         * @method getEdge
         * @param {String} edgeId ID of the Edge to retrieve.
         * @return {Edge} The requested Edge, if found, otherwise null.
         */
        this.getEdge = function (edgeId) {
            return _graph.getEdge(edgeId);
        };

        /**
         * Returns whether or not object(s) exist for the given id(s).
         * @method exists
         * @param {Object...} objects List of ids to check existence for.  This method takes an arbitrary number of arguments.
         * @return {Boolean} True if objects exist for all given ids, false otherwise.
         */
        this.exists = function (objects) {
            for (var i = 0; i < arguments.length; i++) {
                if (_graph.getVertex(arguments[i]) == null) return false;
            }
            return true;
        };

        /**
         * Removes the given Node, which may be passed in as the actual Node object, or its id.
         * @method removeNode
         * @param {Node|String} node Either a Node, or its ID.
         * @return {jsPlumbToolkitInstance} The current Toolkit instance.
         */
        this.removeNode = function (node, doNotFireEvent) {
            node = (node.constructor == jsPlumbGraph.Vertex || node.constructor == jsPlumbGraph.Port) ? node : _graph.getVertex(node);
            var edges = node.getAllEdges() || [];
            for (var i = 0; i < edges.length; i++)
                _currentInstance.removeEdge(edges[i]);
            // delete the vertex from the graph.
            _graph.deleteVertex(node.id);

            // optionally, clean up the original backing data. requires that a DataManager for the current _originalDataType be registered
            // on jsPlumbToolkitIO
            if (!_dataLoading && !doNotUpdateOriginalData)
                root.jsPlumbToolkitIO.manage("removeNode", _originalData, _originalDataType, node, _idFunction || _graph.getIdFunction(), _currentInstance);

            if (!doNotFireEvent) {
                _currentInstance.fire("nodeRemoved", { node: node, nodeId: node.id, edges: edges });
            }
            return _currentInstance;
        };

        /**
         * Adds an Edge to the Graph.
         * @method addEdge
         * @param {Object} params Method params.
         * @param {Node|String} params.source Source Node, or id of the source Node. If given as a string, this may be in "dotted" format, eg. nodeId.portId, to identify a particular port on the source Node.
         * @param {Node|String} params.target Target Node, or id of the target Node. If given as a string, this may be in "dotted" format, eg. nodeId.portId, to identify a particular port on the target Node.
         * @param {Integer} [params.cost=1] Edge cost. This is used when computing shortest paths through the graph. If
         * an Edge is not `directed`, then the same cost is applied regardless of the direction of traversal.
         * @param {Boolean} [params.directed=true] Whether or not the Edge is directed.
         * @return {Edge} The Edge that was added.
         */
        this.addEdge = function (params, source, doNotFireEvent) {
            var edge = _graph.addEdge(params, _edgeIdFunction);

            if (!_dataLoading && !doNotUpdateOriginalData)
                root.jsPlumbToolkitIO.manage("addEdge", _originalData, _originalDataType, edge, _edgeIdFunction || _graph.getIdFunction(), _currentInstance);

            if (!doNotFireEvent) {
                _currentInstance.fire("edgeAdded", { edge: edge, source: source }, null);
            }

            return edge;
        };

        /**
         * Removes an Edge from the Graph.
         * @method removeEdge
         * @param {Edge|String} edge The Edge to remove, as either an Edge object or its id.
         * @param {Object} [source] The source for the removeEdge operation. For internal use.
         * @return {jsPlumbToolkitInstance} The current Toolkit instance.
         */
        this.removeEdge = function (edge, source) {
            edge = _graph.getEdge(edge);
            if (edge != null) {
                // delete the vertex from the graph.
                _graph.deleteEdge(edge);
                // optionally, clean up the original backing data. requires that a DataManager for the current _originalDataType be registered
                // on jsPlumbToolkitIO
                if (!_dataLoading && !doNotUpdateOriginalData)
                    root.jsPlumbToolkitIO.manage("removeEdge", _originalData, _originalDataType, edge, _edgeIdFunction || _graph.getIdFunction(), _currentInstance);

                _currentInstance.fire("edgeRemoved", { edge: edge, source: source }, null);
            }
            return _currentInstance;
        };

        this.edgeMoved = function(edge, obj, index) {
            var current = edge[index === 0 ? "source" : "target"],
                fn = index == 0 ? "setSource" : "setTarget";

            return this[fn](edge, obj);
        };

        /**
         * Sets the target Node/Port for some Edge.
         * @method setTarget
         * @param {Edge} edge Edge to retarget.
         * @param {Node|Port|String} o Node/Port/id for new Edge target
         */
        this.setTarget = function (edge, o, doNotFireEvent) {
            var info = _graph.setTarget.apply(_graph, arguments);
            if (info.success !== false && !doNotFireEvent) {
                _currentInstance.fire("edgeTarget", info);
            }
            return info;
        };

        /**
         * Sets the source Node/Port for some Edge.
         * @method setSource
         * @param {Edge} edge Edge to set source for.
         * @param {Node|Port|String} o Node/Port/id for new Edge source
         */
        this.setSource = function (edge, o, doNotFireEvent) {
            var info = _graph.setSource.apply(_graph, arguments);
            if (info.success !== false && !doNotFireEvent) {
                _currentInstance.fire("edgeSource", info);
            }
            return info;
        };

        /**
         * Adds a new Port to some Node. This will call the current `PortFactory` to get the data for a new Port.
         * @method addNewPort
         * @param {Node|String} node Node or id of the Node to add a new Port to.
         * @param {String} type Type of Port to add.
         * @param {Object} [portData] Optional data to pass to the PortFactory.
         */
        this.addNewPort = function (node, type, portData, doNotFireEvent) {
            node = _graph.getVertex(node);
            _portFactory({node: node, type: type}, portData, function (p) {
                var portId = _portIdFunction(p),
                    port = node.addPort(portId);

                port.data = p;

                if (!_dataLoading && !doNotUpdateOriginalData)
                    root.jsPlumbToolkitIO.manage("addPort", _originalData, _originalDataType, {node: node, port: port}, _portIdFunction || _graph.getIdFunction(), _currentInstance);

                if (!doNotFireEvent) {
                    _currentInstance.fire("portAdded", { node: node, data: p, port: port }, null);
                }
            });
        };

        /**
         * Adds a Port from existing data to some Node. This is distinct from `addNewPort`, because in this
         * case the data for the Port already exists.
         * @method addPort
         * @param {Node|String} node Node or id of the Node to add the Port to.
         * @param {Object} data Data for the Port.
         * @return {Port} The port that was added.
         */
        this.addPort = function (node, data, doNotFireEvent) {
            var p = node.addPort(data, _portIdFunction);

            if (!_dataLoading && !doNotUpdateOriginalData)
                root.jsPlumbToolkitIO.manage("addPort", _originalData, _originalDataType, {node: node, port: p}, _portIdFunction || _graph.getIdFunction(), _currentInstance);

            if (!doNotFireEvent) {
                _currentInstance.fire("portAdded", { node: node, data: data, port: p }, null);
            }
            return p;
        };

        /**
         * Removes the Port with the given id from the given Node.
         * @method removePort
         * @param {Node|String} node Either a node id, or a Node, from which the Port should be removed.
         * @param {String} portId Id of the port to remove from the given node.
         * @return {Boolean} True if the port existed and was removed, false otherwise.
         */
        this.removePort = function (node, portId, doNotFireEvent) {
            var removed = false;
            node = (node.constructor == jsPlumbGraph.Vertex || node.constructor == jsPlumbGraph.Port) ? node : _graph.getVertex(node);
            var port = node.getPort(portId);
            if (port) {
                var edges = port.getAllEdges();
                removed = node.removePort(port);
                if (removed && !doNotFireEvent) {
                    _currentInstance.fire("portRemoved", { node: node, port: port, edges: edges }, null);
                    for (var i = 0; i < edges.length; i++)
                        _currentInstance.removeEdge(edges[i]);
                }
            }
            return removed;
        };

        /**
         * Removes whatever is identified by `obj`, which may be one of a number of things.
         * @method remove
         * @param {Node|Edge|Selection|Path} obj Either a Node id, a Node, an Edge, or Selection or Path whose Nodes/Ports and Edges to remove.
         */
        this.remove = function (obj) {
            if (obj == null) return;
            var o = _currentInstance.getObjectInfo(obj);
            _currentInstance.setSuspendRendering(true);

            try {
                if (o.obj && (o.type == "Node" || o.type == "Edge")) {
                    _currentInstance["remove" + o.type](o.obj);
                }
                else {

                    while (obj.getNodeCount() > 0) {
                        _currentInstance.removeNode(obj.get(0));
                    }

                    while (obj.getEdgeCount() > 0) {
                        _currentInstance.removeEdge(obj.getEdge(0));
                    }
                }
            }
            finally {
                _currentInstance.setSuspendRendering(false, true);
            }
        };

        /**
         * Suspends or re-enables rendering. This method simply round-robins all the registered renderers
         * and calls `setSuspendRendering` on each of them.
         * @method setSuspendRendering
         * @param {Boolean} v True to suspend rendering, false to enable it.
         * @param {Boolean} [thenRefresh=false] If true, a refresh will be called on all renderers after rendering is unsuspended.
         */
        this.setSuspendRendering = function (v, thenRefresh) {
            for (var r in _renderersById)
                _renderersById[r].setSuspendRendering(v, thenRefresh);
        };

        /**
         * Suspends rendering and then runs the given function, unsuspending rendering afterwards and doing
         * a refresh. This method is just a convenience method that handles suspending
         * and subsequent enabling of rendering. You might use this if you're adding a whole load of Nodes or
         * Edges, or maybe you want to add a Node and one or more Edges before
         * the layout recomputes.
         * @param fn
         */
        this.batch = function (fn) {
            _currentInstance.setSuspendRendering(true);
            try {
                fn();
            }
            catch (e) {
                jsPlumbUtil.log("Error in transaction " + e);
            }
            finally {
                _currentInstance.setSuspendRendering(false, true);
            }
        };

        var _updateNodeOrPort = function (obj, updates, evtId, generator, refresh) {
            var n = _graph.getNode(obj);
            if (n && n.objectType) {
                if (updates) {
                    for (var u in updates) {
                        JUTIL.replace(n.data, u, updates[u]);
                    }
                }
                _currentInstance.fire(evtId, generator(n), null);
            }
        }.bind(this);

        /**
         * Updates the given Node, notifying any Renderers to do a redraw. If autoSave is set, this method
         * will cause the dataset to be saved.
         * @method updateNode
         * @param {Node|String|Object} node Either a Node, a Node id, or the backing data for a Node.
         * @param {Object} [updates] An object with path->value pairs. Path can be in dotted notation. You do not actually have to supply this, although in most cases you will want to. But there are edge cases in which you might simply wish to kick off a repaint.
         */
        this.updateNode = function (node, updates) {
            _updateNodeOrPort(node, updates, "nodeUpdated", function (o) {
                return { node: o, updates:updates || {} };
            });
        };

        /**
         * Updates the given Port, notifying any Renderers to do a redraw. If autoSave is set, this method
         * will cause the dataset to be saved.
         * @method updatePort
         * @param {Port|String|Object} port Either a Port, a Port id, or the backing data for a Port.
         * @param {Object} [updates] An object with path->value pairs. Path can be in dotted notation. You do not actually have to supply this, although in most cases you will want to. But there are edge cases in which you might simply wish to kick off a repaint.
         */
        this.updatePort = function (port, updates) {
            _updateNodeOrPort(port, updates, "portUpdated", function (o) {
                return { port: o, node: o.getNode(), updates:updates || {} };
            });
        };

        /**
         * Updates the given Edge, notifying any Renderers to do a redraw. If autoSave is set, this method
         * will cause the dataset to be saved.
         * @method updateEdge
         * @param {Edge|String|Object} edge Either an Edge, an Edge id, or the backing data for an Edge.
         * @param {Object} [updates] An object with path->value pairs. Path can be in dotted notation. You do not actually have to supply this, although in most cases you will want to. But there are edge cases in which you might simply wish to kick off a repaint.
         */
        this.updateEdge = function (edge, updates) {
            var e = _graph.getEdge(edge);
            if (e) {
                if (updates) {
                    for (var u in updates) {
                        if (e.data[u] == null)
                            e.data[u] = updates[u];
                        else
                            JUTIL.replace(e.data, u, updates[u]);
                    }
                }
                _currentInstance.fire("edgeUpdated", {edge: e, updates:updates || {}}, null);
            }
        };

        /**
         * Updates the given object, notifying any renderers to do a repaint.
         * @param {Node|Port|Edge|String} object Either a Node, Port or Edge, or, as a string, the id of some Node or Port.
         * @param {Object} [updates] An object with path->value pairs. Path can be in dotted notation. You do not actually have to supply this, although in most cases you will want to. But there are edge cases in which you might simply wish to kick off a repaint.
         * @return {Node|Port|Edge} The object that was updated, or null if not found.
         */
        this.update = function (object, updates) {
            if (JUTIL.isString(object)) object = this.getNode(object);
            if (object && object.objectType) {
                this["update" + object.objectType](object, updates);
            }
            return object;
        };

// ----------------- end nodes

// -------------------------- miscellaneous -------------------------------------


// -------------------------- end miscellaneous -------------------------------------

// ---------------------------- paths ------------------------------------------------

        /**
         * Gets a Path from some source Node/Port to some target Node/Port.
         * @param {Object} params Path spec params
         * @param {Node|Port|String} params.source Source node or port, or id of source node/port
         * @param {Node|Port|String} params.target Target node or port, or id of target node/port
         * @param {Boolean} [params.strict=true] Sets whether or not paths are searched strictly by the given source/target. If, for instance, you supply a node as the source, but there are only edges connected to ports on that node, by default these edges will be ignored. Switching `strict` to false will mean these edges are considered.
         * @param {Function} [params.nodeFilter] Optional function that is given each Node's backing data and asked to return true or false - true means include the Node, false means exclude it.
         * @param {Function} [params.edgeFilter] Optional function that is given each Edge's backing data and asked to return true or false - true means include the Edge, false means exclude it.
         * @return {Path} a Path object. Even if no path exists you will get a return value - but it will just be empty.
         */
        this.getPath = function (params) {
            return new root.jsPlumbToolkit.Path(this, params);
        };

        /**
         * Finds the Graph object that matches the given spec.
         * @method findGraphObject
         * @param {String|Node|Port} spec If a string, a Node/Port matching that id is retrieved. Otherwise if `spec` is already a Graph object (Node or Port), it is
         * returned.
         * @return {Node|Port} Node or Port matching the spec, null if no match or spec was not a Graph object.
         */
        var _findGraphObject = this.findGraphObject = function (spec) {
            if (spec == null) return null;
            if (spec === "*") return _graph;
            else if (spec.constructor == jsPlumbGraph.Vertex || spec.constructor == jsPlumbGraph.Port)
                return spec;
            else if (JUTIL.isString(spec) || JUTIL.isObject(spec))
                return _graph.getVertex(spec);
            return null;
        };

        var _selectEdges = function (params, edgeSelector, checkForPorts) {
            var edges = [], _edgeMap = {},
                _add = function (edge) {
                    if (!_edgeMap[edge.getId()]) {
                        edges.push(edge);
                        _edgeMap[edge.getId()] = true;
                    }
                },
                _addEdges = function (obj, matchSource, matchTarget, matchElement) {
                    if (obj != null) {
                        var e = obj[edgeSelector]({filter: params.filter});
                        for (var i = 0; i < e.length; i++) {
                            var isSource = ((matchSource && obj == _graph) || e[i].source == obj || (checkForPorts && e[i].source.constructor == jsPlumbGraph.Port && e[i].source.getNode() == obj)),
                                isTarget = ((matchTarget && obj == _graph) || e[i].target == obj || (checkForPorts && e[i].target.constructor == jsPlumbGraph.Port && e[i].target.getNode() == obj));

                            if ((matchSource && isSource) || (matchTarget && isTarget) || (matchElement && (isSource || isTarget)))
                                _add(e[i]);
                        }
                    }
                };

            _addEdges(_findGraphObject(params.source), true, false, false);
            _addEdges(_findGraphObject(params.target), false, true, false);
            _addEdges(_findGraphObject(params.element), false, false, true);
            return edges;
        };

        /**
         * Gets a set of edges.
         * @method getEdges
         * @param {Object} params parameters for the select call
         * @param {Node|String} [params.source] Source Node or id of source Node from which to select Edges.
         * @param {Node|String} [params.target] Target Node or id of target Node from which to select Edges.
         */
        this.getEdges = function (params) {
            return _selectEdges(params, "getEdges", false);
        };

        /**
         * Get all edges in the toolkit instance.
         * @method getAllEdges
         * @param {Object} params Parameters for the selectAllEdges call.
         */
        this.getAllEdges = function (params) {
            return _selectEdges(params, "getAllEdges", true);
        };

        /**
         * Gets all edges for the given Node or Port.
         * @param {Node|Port} obj Object to retrieve edges for.
         * @param {Function} [filter] Optional filter function for edge selection.
         * @return a list of Edges.
         */
        this.getAllEdgesFor = function(obj, filter) {
            return obj.getAllEdges({filter:filter});
        };

// ---------------------------- end paths ------------------------------------------------

// ---------------------- import /export -------------------------------

        var _originalData, _originalDataType, _dataLoading;
        var _doLoad = function(params, startEvent, endEvent) {
            params = params || {};

            var type = params.type || "json",
                data = params.data,
                url = params.url,
                jsonp = params.jsonp,
                onload = params.onload,
                parameters = params.parameters || { },
                error = params.error || function () { };

            if (data == null && url == null) {
                throw new TypeError("You must supply either data or url to load.");
            }

            var parse = function (d) {
                _originalData = d;
                _originalDataType = type;
                _dataLoading = true;
                _currentInstance.fire(startEvent);
                root.jsPlumbToolkitIO.parse(type, d, _currentInstance, parameters);
                _notifyDataLoaded(endEvent);
                if (onload) onload(_currentInstance, d);
                _currentInstance.fire("graphChanged");
            };

            // then, import the data.
            if (data) {
                parse(data);
            }
            else if (url) {
                if (jsonp) {
                    var sep = url.indexOf("?") === -1 ? "?" : "&";
                    url = url + sep + "callback=?";
                }

                var dataType = type === "json" ? type : params.dataType;
                var headers = params.headers || { Accept:"application/json" };
                UTIL.ajax({
                    url: url,
                    success: parse,
                    dataType: dataType,
                    error: error,
                    headers:headers
                });
            }

            return _currentInstance;
        };


        /**
         * Loads some data, either via ajax, or directly from a JS object.
         * @method load
         * @param {Object} params Load parameters.
         * @param {String} [params.type="json"] Specifies the data type of the data to load. This must match the name of a loader registered with the given instance of the Toolkit.
         * @param {Object} [params.data] Optional. JSON data to load directly.
         * @param {String} [params.url]  URL to retrieve data from. Optional, but you need to supply either this or `data`.
         * @param {Boolean} [params.jsonp=false] Optional, defaults to false. Tells the Toolkit that the data is coming via JSON-P.
         * @param {Function} [params.onload] Optional callback to execute once the data has loaded. Most often used when you are retrieving remote data (using `url` and possibly `jsonp`)
         * @param {Object} [params.parameters] Optional parameters to pass to the loader.
         * @param {Function} [params.error] Optional function to call on load error.
         * @param {Object} [params.headers] Optional map of HTTP header values, if loading via URL.
         * @return {jsPlumbToolkitInstance} The current instance of the Toolkit. If you provide data directly to this method you can then chain a load call with a subsequent `render`.
         */
        this.load = function (params) {
            return _doLoad(params, "dataLoadStart", "dataLoadEnd");
        };

        /**
         * Appends some data to the dataset, either via ajax, or directly from a JS object. The only difference
         * between this and `load` is the events that are fired during the loading process.
         * @method append
         * @param {Object} params Append parameters.
         * @param {String} [params.type="json"] Specifies the data type of the data to load. This must match the name of a loader registered with the given instance of the Toolkit.
         * @param {Object} [params.data] Optional. JSON data to load directly.
         * @param {String} [params.url]  URL to retrieve data from. Optional, but you need to supply either this or `data`.
         * @param {Boolean} [params.jsonp=false] Optional, defaults to false. Tells the Toolkit that the data is coming via JSON-P.
         * @param {Function} [params.onload] Optional callback to execute once the data has loaded. Most often used when you are retrieving remote data (using `url` and possibly `jsonp`)
         * @param {Object} [params.parameters] Optional parameters to pass to the loader.
         * @param {Function} [params.error] Optional function to call on load error.
         * @return {jsPlumbToolkitInstance} The current instance of the Toolkit. If you provide data directly to this method you can then chain a load call with a subsequent `render`.
         */
        this.append = function (params) {
            return _doLoad(params, "dataAppendStart", "dataAppendEnd");
        };

        /**
         * Saves the current data via ajax POST to a given URL.
         * @method load
         * @param {Object} params Load parameters
         * @param {String} [params.type="json"] Specifies the data type in which to format the data. This must match the name of an exporter registered with the given instance of the Toolkit.
         * @param {String} params.url URL to POST data to.
         * @param {Object} [params.parameters] Optional parameters to pass to the exporter. If you write a custom exporter you may wish to use this.
         * @param {Function} [params.success] Callback to execute once the data has saved successfully.
         * @param {Function} [params.error] Callback to execute if there was an error saving the data.
         * @return {jsPlumbToolkitInstance} The current instance of the Toolkit. If you provide data directly to this method you can then chain a load call with a subsequent `render`.
         */
        this.save = function (params) {
            params = params || {};
            var data = this.exportData(params);
            UTIL.ajax({
                url: params.url,
                type: "POST",
                data: data,
                success: params.success,
                error: params.error
            });
            return _currentInstance;
        };

        /**
         * Exports the current data to JSON.
         * @method exportData
         * @param {Object} params Export parameters
         * @param {String} [params.type="json"] Specifies the data type in which to format the data. This must match the name of an exporter registered with the given instance of the Toolkit.
         * @param {Object} [params.parameters] Optional parameters to pass to the exporter. If you write a custom exporter you may wish to use this.
         * @return {Object} JSON payload.
         */
        this.exportData = function (params) {
            params = params || {};
            return root.jsPlumbToolkitIO.exportData(params.type || "json", _currentInstance, params.parameters);
        };

        // ------------------------------------- NODE/EDGE selection -----------------------------------

        var _createSelection = function (onClear) {
            return new UTIL.Selection({
                toolkit: _currentInstance,
                onClear: onClear || function () {
                }
            });
        };

        var _currentSelection = _createSelection(function (sel) {
            _currentInstance.fire("selectionCleared", {
                selection: sel
            });
        });
        if (params.maxSelectedNodes) {
            _currentSelection.setMaxNodes(params.maxSelectedNodes);
        }
        if (params.maxSelectedEdges) {
            _currentSelection.setMaxEdges(params.maxSelectedEdges);
        }
        if(params.selectionCapacityPolicy) {
            _currentSelection.setCapacityPolicy(params.selectionCapacityPolicy);
        }

        var _select = function (obj, append, _selection, fireSelectEvent) {
            if (!append) _selection.clear(true);
            return _selection.append(obj, function (o) {
                if (fireSelectEvent) {
                    _currentInstance.fire("select", {
                        append: append,
                        obj: o,
                        selection: _selection
                    });
                }
            });
        };

        /**
         * Sets obj as the current selection for this instance of the jsPlumb Toolkit.
         * @method setSelection
         * @param {Node|Edge|Node[]|Edge[]|Path|String} obj Object to select. May be a Node/Edge or an array of either
         * of these, or a Node id, or a Path.
         */
        this.setSelection = function (obj) {
            _select(obj, false, _currentSelection, true);
        };

        /**
         * Gets an ad-hoc selection
         * @method select
         * @param {Node|Port|Edge|Node[]|Port[]|Edge[]|Path|String} obj Object to select. May be a Node/Port/Edge or an array of either
         * of these, or a Node id, a Selection, or a Path.
         */
        this.select = function (obj, includeEdges) {
            var s = _createSelection();
            var objects = _select(obj, true, s);
            if (includeEdges) {
                for (var i = 0; i < objects[0].length; i++) {
                    var so = objects[0][i];
                    if (so.objectType == "Node" || so.objectType == "Port") {
                        var ae = so.getAllEdges();
                        for (var j = 0; j < ae.length; j++)
                            s.append(ae[j]);
                    }
                }
            }
            return s;
        };

        var _descendants = function (focus, selection, includeEdges, touched) {
            var edges = focus.getAllEdges();
            for (var i = 0, j = edges.length; i < j; i++) {
                if (edges[i].source === focus || (edges[i].getNode && edges[i].getNode() === focus)) {
                    var t = edges[i].target, tid = t.getFullId();
                    if (!touched[tid]) {
                        selection.append(t);
                        if (includeEdges) selection.append(edges[i]);
                        touched[tid] = true;
                        _descendants(t, selection, includeEdges, touched);
                    }
                }
            }
        };

        /**
         * Selects all descendants of some Node, and, optionally, the Node itself.
         * @method selectDescendants
         * @param {Node|Port|Edge|Node[]|Port[]|Edge[]|Path|String} obj Object to select. May be a Node/Port/Edge or an array of either
         * of these, or a Node id, a Selection, or a Path.
         * @param {Boolean} [includeRoot=false] Whether or not to include the root node in the returned dataset.
         * @param {Boolean} [includeEdges=false] Whether or not to include edges in the returned dataset.
         */
        this.selectDescendants = function (obj, includeRoot, includeEdges) {
            var info = _currentInstance.getObjectInfo(obj);
            var s = _createSelection();

            if (info.obj && info.obj.objectType === "Node") {
                if (includeRoot) _select(info.obj, true, s);
                var touched = {};
                touched[info.obj.getFullId()] = true;
                _descendants(info.obj, s, includeEdges, touched);
            }

            return s;
        };

        /**
         * Gets a Selection that is a filtered set of Nodes and Edges.
         * @param {Object|Function} spec Either a function, which will be passed each Edge and Node and is expected to return
         * true to indicate inclusion, or an object consisting of key/value pairs, all of which are expected to match the `data` for any Edge or Node that should be included in the output.
         * @param {Boolean} [includePartials=false] If true, and you're using a match object, the results will include any objects that match at least one key in the match object.
         * @return {Selection} A Selection.
         */
        this.filter = function (spec, includePartials) {
            var fn = typeof spec == "function" ? spec : function (obj) {
                    var d = obj.data, out = false;
                    for (var i in spec) {
                        var match = spec[i] === d[i];
                        if (!match && !includePartials) return false;
                        out = out || match;
                    }
                    return out;
                },
                s = _createSelection();

            this.eachNode(function (i, n) {
                if (fn(n)) s.append(n);
                var o = n.getPorts();
                for (var j = 0; j < o.length; j++)
                    if (fn(o[j])) s.append(o[j]);
            });

            this.eachEdge(function (i, e) {
                if (fn(e)) s.append(e);
            });

            return s;
        };

        /**
         * Appends `obj` to the current selection. If there is no current selection, `obj` becomes it.
         * @method addToSelection
         * @param {Node|Edge|Node[]|Edge[]|Path|String|Element} obj Object to select. May be a Node/Edge or an array of either
         * of these, or a Node id, or a Path, or a DOM element.
         */
        this.addToSelection = function (obj) {
            var info = this.getObjectInfo(obj);
            if (info) {
                var objects = _select(info.obj, true, _currentSelection, true);
                _adhocSel("deselect", objects[1]);
                _adhocSel("select", objects[0]);
            }
        };

        var _adhocSel = function(evt, objects) {
            for (var i = 0; i < objects.length; i++) {
                _currentInstance.fire(evt, {
                    obj: objects[i],
                    selection: _currentSelection
                });
            }
        };
        /**
         * Toggles whether or not the given `obj` forms part of the current selection.
         * @param {Node|Edge|Node[]|Edge[]|Path|String} obj Object to select. May be a Node/Edge or an array of either
         * of these, or a Node id, or a Path, or a DOM element.
         */
        this.toggleSelection = function (obj) {
            var info = this.getObjectInfo(obj);
            if (info) {
                var sel = [], desel = [];
                var objects = _currentSelection.toggle(info.obj, function (o, wasAdded) {
                    // seems we dont need to add to 'sel'
                    if (!wasAdded) {
                        desel.push(o);
                    }
                });
                _adhocSel("deselect", objects[1]);
                _adhocSel("deselect", desel);
                _adhocSel("select", objects[0]);
                //_adhocSel("select", sel);
            }
        };

        /**
         * Removes obj from the current selection
         * @method deselect
         * @param {Node|Edge|Node[]|Edge[]|Path|String} obj Object to deselect. May be a Node/Edge or an array of either
         * of these, or a Node id, or a Path, or a DOM element.
         */
        this.removeFromSelection = function (obj) {
            var info = this.getObjectInfo(obj);
            if (info) {
                _currentSelection.remove(info.obj, function (o) {
                    _currentInstance.fire("deselect", {
                        obj: o,
                        selection: _currentSelection
                    });
                });
            }
        };

        /**
         * Appends the Path from `source` to `target` to the current selection. If there is no current selection, `obj` becomes it.
         * If the Path does not exist, there is no selection.
         * @method addPathToSelection
         * @param {Object} params Path params
         * @param {Node|String} params.source ID of source, or source Node/Port
         * @param {Node|String} params.target ID of target, or target Node/Port
         */
        this.addPathToSelection = function (params) {
            this.addToSelection(this.getPath(params));
        };

        /**
         * Sets the current selection to be every node in the toolkit instance.
         * @method selectAll
         */
        this.selectAll = function () {
            // get all nodes, pipe them into the select function.
            throw new TypeError("not implemented");
        };

        /**
         * Clears the current selection and fires a `selectionCleared` event.
         * @method clearSelection
         */
        this.clearSelection = _currentSelection.clear;

        /**
         * Gets the current Selection for this Toolkit instance.
         * @method getSelection
         * @return {Selection} Current Selection.
         */
        this.getSelection = function () {
            return _currentSelection;
        };

        /**
         * Sets the maximum number of nodes that may be selected at any one time. Default is Infinity.
         * @method setMaxSelectedNodes
         * @param {Integer} maxNodes Max number of nodes allowed to be selected at once.
         */
         this.setMaxSelectedNodes = function(maxNodes) {
             _currentSelection.setMaxNodes(maxNodes);
         };

        /**
         * Sets the maximum number of edges that may be selected at any one time. Default is Infinity.
         * @method setMaxSelectedEdges
         * @param {Integer} maxEdges Max number of edges allowed to be selected at once.
         */
        this.setMaxSelectedEdges = function(maxEdges) {
            _currentSelection.setMaxEdges(maxEdges);
        };

        /**
         * Sets The action taken when appending an edge or node that would
         * take the selection above its limit for that given type. Depends on the current `capacityPolicy`, which can be either
         * Selection.DISCARD_EXISTING (the default) or Selection.DISCARD_NEW.
         * @method setSelectionCapacityPolicy
         * @param {String} policy One of `Selection.DISCARD_EXISTING` (which removes the 0th entry from the list before insertion of the new value) or `Selection.DISCARD_NEW`.
         */
        this.setSelectionCapacityPolicy = function(policy) {
            _currentSelection.setCapacityPolicy(policy);
        };

// --------------------- rendering -------------------------------------

        var // notification that some data was loaded. initializes all current renderers.
            _notifyDataLoaded = function (endEvent) {
                _currentInstance.setSuspendGraph(true);
                _currentInstance.fire(endEvent);
                _currentInstance.setSuspendGraph(false);
                _dataLoading = false;
            },
            _renderersById = {};

        /**
         * Configures the given element as a renderer, registering it so that it reflects any changes to the
         * underlying data. This method turns the given element into a Surface if it is not already one.  If there is any data in the
         * Toolkit at the time of this call it is rendered; any data subsequently loaded is automatically rendered. You can supply
         * layout arguments to this method (layout type + layout specific parameters), as well as jsPlumb rules for
         * endpoints, paint styles etc.
         * @method render
         * @param {Object} params Method parameters
         * @param {Element|Selector} params.container Element to convert into a Surface.
         * @param {String} [params.id] Optional id to register the created Surface against. You can then retrieve the Surface via `toolkit.getRenderer(id)`. If you do not provide this, one will be assigned. The ID is written as the renderer's `id` property.
         * @param {Boolean} [params.elementsDraggable=true] Whether or not elements in the Surface should be draggable.
         * @param {Object} [params.dragOptions] Options for draggable elements.
         * @param {Object} [params.events] Optional event bindings. See documentation.
         * @param {Object} [params.miniview] Optional miniview configuration. See documentation.
         * @param {String} [params.mode="Pan"] Mode to initialize the Surface in.
         * @param {Number} [params.panDistance=50] How far a pan nudge should move the UI (in pixels).
         * @param {Boolean} [params.enablePan=true] Whether or not panning (via mouse drag) is enabled.
         * @param {Boolean} [params.enableWheelZoom=true] Whether or not zooming with the mouse wheel is enabled.
         * @param {String} [params.wheelFilter] Optional CSS selector representing elements that should not respond to wheel zoom.
         * @param {Number} [params.wheelSensitivity=10] How many pixels each click of the mouse wheel represents when zooming. Note that this value, while expressed in pixels, is mapped in a variety of ways depending on the browser.
         * @param {Boolean} [params.enablePanButtons=true] Whether or not to show the pan nudge buttons on the borders of the widgets.
         * @param {Number[]} [params.padding] Optional values for padding in the x/y axes to leave around the content. This is only of any use if you have disabled panning via mouse drag,
         * since in that case the user sees only scroll bars and has no way of navigating beyond the content. Some padding makes the UI nicer to use. Default is [0,0].
         * @param {String} [params.lassoFilter] Optional selector for elements on which a mousedown should not cause the lasso to activate.
         * @param {Boolean} [params.consumeRightClick=true] Useful for development: set this to false if you don't want the widget to consume context menu clicks.
         * @param {Object} [params.jsPlumb] Optional set of jsPlumb Defaults to use for this renderer. The format and allowed properties is that of
         *                 the Defaults object in jsPlumb. You can also set display properties in the model.
         * @param {Boolean} [params.enhancedModel=true] If false, there will be no support for preconfigured parameters or functions in the definitions inside a Model. You will want to set this for Angular if you use the 2-way data binding.
         */
        this.render = function (params, referenceParams) {
            var p = jsPlumb.extend({}, referenceParams || {});
            jsPlumb.extend(p, params);
            p.toolkit = _currentInstance;

            // if a selection supplied, set that as the toolkit (model supplier, basically). two cases
            // are supported: one, that `selection` is a pre-prepared Selection, in which case we use it.
            // second case is that `selection` is just some function that can populate a selection, in
            // which case we make a new Selection and set what we were given as its "generator".
            if (params.selection != null) {
                if (params.selection.constructor === jsPlumbToolkitUtil.Selection) {
                    p.toolkit = params.selection;
                }
                else {
                    p.toolkit = new jsPlumbToolkitUtil.Selection({
                        generator: params.selection,
                        toolkit:_currentInstance
                    });
                }
            }

            var type = p.type || root.jsPlumbToolkit.DefaultRendererType;
            var renderer = new root.jsPlumbToolkit.Renderers[type](p);
            var id = p.id || jsPlumbUtil.uuid();
            _renderersById[id] = renderer;
            renderer.id = id;
            return renderer;
        };

        /**
         * Gets a renderer by the `id` parameter supplied to the `render` call (which is by default null, and only renderers for which an `id` was supplied are retrievable via this method)
         * @method getRenderer
         * @param {String} id ID of the renderer to retrieve.
         * @return {AbstractRenderer} Either a Renderer that was registered against the given id, or null if none found.
         */
        this.getRenderer = function (id) {
            return _renderersById[id];
        };

        /**
         * Gets all renderers registered on this instance of the jsPlumb Toolkit.
         * @method getRenderers
         * @return {Object} A map of `id-> Renderer` pairs.
         */
        this.getRenderers = function () {
            return _renderersById;
        };

        /**
         * Finds information related to the given object, which may be a DOM node or an existing Toolkit object. This function is
         * useful for mapping some UI element to its underlying data.
         * @method getObjectInfo
         * @param {String|Element|Node|Port} obj An element id, node id, DOM element, Node or Port.
         * @param {Function} [elementResolver] For internal use. Resolves a Node or Port into its DOM element.
         * @return {Object} A JS object containing `obj` (the Toolkit object), `id` (the Node/Port ID), `type` ("port" or "node"), `els` - a map of Surface ids
         * to [ Surface, Element ] pairs, one for each Surface that has rendered the given Node/Port.
         */
        this.getObjectInfo = function (obj, elementResolver) {
            var out = { els: {}, obj: null, type: null, id: null, el: null },
                _findJtkParent = function (el) {
                    if (el != null) {
                        if (el.jtk) return el;
                        return _findJtkParent(el.parentNode);
                    }
                },
                _findEls = function (item) {
                    var o = {};
                    for (var i in _renderersById) {
                        o[i] = [
                            _renderersById[i],
                            _renderersById[i].getRenderedElement(item)
                        ];
                    }
                    return o;
                };

            if (obj != null) {
                if (obj.eachNode && obj.eachEdge) return {obj:obj}; // a Path, Selection, or Toolkit instance.
                else if (jsPlumbUtil.isArray(obj)) return { obj:obj }; // an array
                var de = jsPlumb.getElement(obj);
                if (de != null && de.jtk) {
                    out.el = de;
                    out.obj = de.jtk.port || de.jtk.node;
                } else if (obj.tagName != null) {
                    // it's some element that is a child of a toolkit object.
                    var jp = _findJtkParent(de);
                    if (jp != null) {
                        out.el = jp;
                        out.obj = jp.jtk.port || jp.jtk.node;
                    }
                } else {
                    if (typeof obj === "string") {
                        obj = this.getNode(obj);
                    }
                    if (obj != null) {
                        // it's a toolkit object (in theory.)
                        out.obj = obj;
                        if (elementResolver != null)
                            out.el = elementResolver(obj);
                    }
                    else
                        return out;
                }

                if (elementResolver == null)
                    out.els = _findEls(out.obj);

                if (out.obj != null) {
                    out.id = out.obj.id;
                    out.type = out.obj.objectType;
                }
            }
            return out;
        };

        // if data supplied to constructor, load it.
        if (params.data) {
            var t = params.dataType || "json";
            _currentInstance.load({
                data: params.data,
                type: t
            });
        }
    };

    JUTIL.extend(root.jsPlumbToolkitInstance, JUTIL.EventGenerator);


// ---------------------- static jsPlumbToolkit members ----------------------------------------
    root.jsPlumbToolkit = new root.jsPlumbToolkitInstance({});
    root.jsPlumbToolkit.DefaultRendererType = null;
    root.jsPlumbToolkit.ready = jsPlumb.ready;
    root.jsPlumbToolkit.Renderers = {};
    root.jsPlumbToolkit.Widgets = {};
    /**
     * Gets a new instance of the jsPlumb Toolkit.
     * @param params Valid constructor parameters for a jsPlumbToolkitInstance.
     * @returns {jsPlumbToolkitInstance}
     */
    root.jsPlumbToolkit.newInstance = function (params) {
        return new root.jsPlumbToolkitInstance(params);
    };

}).call(this);
;
(function () {

    // --------------------------------------------- MODEL -------------------------------------------------

    var JTK = jsPlumbToolkit,
        UTIL = jsPlumbToolkitUtil,
        JUTIL = jsPlumbUtil;

    /**
     * A Model describes the appearance and behaviour of a set of Nodes, Edges and Ports. You do not
     * create one of these directly; instead you pass a definition to a `jsPlumbToolkit.render` or
     * `jsPlumbToolkit.newInstance()` call. Although the Model has the same syntax in each context, you are
     * encouraged to configure model-specific things in the Model you pass to the `newInstance` method (such as,
     * which Nodes/Ports can be connected to which others, what is the maximum number of connections, etc), and
     * view-specific things (such as css classes, paint styles, connector appearance etc) to the model you pass to
     * the `render` method. The `render` method automatically merges in a Node/Port/Edge definition from a Model
     * defined on the associated Toolkit, if there is one.
     * @class jsPlumbToolkit.Model
     * @constructor
     * @param {Object} params Model parameters
     * @param {Object} [params.nodes] Node definitions.
     * @param {Object} [params.edges] Edge definitions.
     * @param {Object} [params.ports] Port definitions.
     * @param {jsPlumbInstance} [_jsPlumb] An instance of jsPlumb on which to register associated Connection and Endpoint types.
     * Only the Surface widget provides this. The Toolkit instance creates a Model but it is headless.
     */
    JTK.Model = function (params, _jsPlumb) {

        params = params || { };
        params.nodes = params.nodes || {};
        params.edges = params.edges || {};
        params.ports = params.ports || {};

        var _states = {}, def, i;

        var _getNodeDefinition = function (typeId) {
                var _def = UTIL.mergeWithParents([typeId, "default"], params.nodes);
                delete _def.parent;
                return _def;
            },
            _getEdgeDefinition = function (typeId) {
                var _def = UTIL.mergeWithParents([typeId, "default"], params.edges);
                delete _def.parent;
                return _def;
            },
            _getPortDefinition = function (portId, nodeDefinition) {
                var _def = nodeDefinition && nodeDefinition.ports ? UTIL.mergeWithParents([portId, "default"], nodeDefinition.ports) : UTIL.mergeWithParents([portId, "default"], params.ports);
                delete _def.parent;
                return _def;
            };

// populate the connection and endpoint types in the supplied jsPlumb instance (if it was supplied. The Toolkit does not
// provide a jsPlumb instance; it is headless.

        if (typeof _jsPlumb != "undefined") {
            // edges (connections)
            for (var di in params.edges) {
                def = _getEdgeDefinition(di);
                // now look for listeners registered on overlays. we actually want to replace those	with our
                // own listeners, because jsPlumb passes only the overlay and the event, whereas we want to pass
                // the event and the overlay as well as the edge and connection.
                if (def.overlays) {
                    for (i = 0; i < def.overlays.length; i++) {
                        if (JUTIL.isArray(def.overlays[i]) && def.overlays[i][1].events) {
                            for (var j in def.overlays[i][1].events) {
                                def.overlays[i][1].events[j] = (function (fn, overlay) {
                                    return function (o, e) {
                                        fn.call(overlay, {
                                            overlay: o,
                                            e: e,
                                            component: o.component,
                                            edge: o.component.edge
                                        });
                                    }
                                })(def.overlays[i][1].events[j], def.overlays[i]);
                            }
                        }
                    }
                }
                _jsPlumb.registerConnectionType(di, def);
            }
            // ports (endpoints)
            for (i in params.ports) {
                def = _getPortDefinition(i);
                _jsPlumb.registerEndpointType(i, def);
            }

            // UI states. These result in `connectionType` definitions on the associated jsPlumb for edges,
            // but for nodes the manipulations are made on the DOM elements.
            if (params.states) {
                for (var s in params.states) {
                    _states[s] = new JTK.UIState(s, params.states[s], _jsPlumb);
                }
            }
        }

        return {
            getNodeDefinition: _getNodeDefinition,
            getEdgeDefinition: _getEdgeDefinition,
            getPortDefinition: _getPortDefinition,
            getState: function (stateId) {
                return _states[stateId];
            }
        };
    };

// --------------------------------------------- / MODEL -------------------------------------------------


}).call(this);
/**
 * functionality to support template loading from script tags (browser only)
 *
 * copyright 2015 jsPlumbToolkit.com
 */
;(function() {
    var jptr = jsPlumbToolkit.ready,
        Queue = function (templateHolder) {
            var c = 0,
                _dec = function () {
                    c--;
                    if (c <= 0) {
                        _toolkitReady();
                    }
                };

            this.add = function (src) {
                c++;
                jsPlumbToolkitUtil.ajax({
                    url: src,
                    success: function (html) {
                        var ih = templateHolder.innerHTML;
                        ih += html;
                        templateHolder.innerHTML = ih;
                        _dec();
                    },
                    error: function (http) {
                        _dec();
                        //_log(&quot;jsPlumbToolkit: cannot load model from &quot; + src);
                    }
                });
            };

            this.ensureNotEmpty = function() {
                if (c <= 0) _toolkitReady();
            };
        },
        readyFuncs = [],
        _ready = false,
        _toolkitReady = function () {
            _ready = true;
            for (var i = 0; i < readyFuncs.length; i++) {
                jptr.call(jptr, readyFuncs[i])
            }
        };

    jsPlumbToolkit.ready = function (f) {
        if (!_ready)
            readyFuncs.push(f);
        else
            jptr.call(jptr, f);
    };

    jsPlumb.ready(function () {
        var templateHolder = document.getElementById("jsPlumbToolkitTemplates");
        if (!templateHolder) {
            templateHolder = document.createElement("div");
            templateHolder.style.display = "none";
            templateHolder.id = "jsPlumbToolkitTemplates";
            document.body.appendChild(templateHolder);

            var queue = new Queue(templateHolder);

            var tags = document.getElementsByTagName("script");
            for (var i = 0; i < tags.length; i++) {
                var type = tags[i].getAttribute("type"), src = tags[i].getAttribute("src");
                if (type == "text/x-jtk-templates") {
                    queue.add(src);
                }
            }

            queue.ensureNotEmpty();
        }
        else {
            _toolkitReady();
        }

    });

}).call(this);
;
(function () {

    "use strict";

    this.jsPlumbToolkit.Classes = {
        LASSO: "jtk-lasso",
        LASSO_SELECT_DEFEAT: "jtk-lasso-select-defeat",
        MINIVIEW: "jtk-miniview",
        MINIVIEW_CANVAS: "jtk-miniview-canvas",
        MINIVIEW_PANNER: "jtk-miniview-panner",
        MINIVIEW_ELEMENT: "jtk-miniview-element",
        MINIVIEW_PANNING: "jtk-miniview-panning",
        MINIVIEW_COLLAPSE: "jtk-miniview-collapse",
        MINIVIEW_COLLAPSED: "jtk-miniview-collapsed",
        NODE: "jtk-node",
        PORT: "jtk-port",
        SURFACE: "jtk-surface",
        SURFACE_NO_PAN: "jtk-surface-nopan",
        SURFACE_CANVAS: "jtk-surface-canvas",
        SURFACE_PAN: "jtk-surface-pan",
        SURFACE_PAN_LEFT: "jtk-surface-pan-left",
        SURFACE_PAN_TOP: "jtk-surface-pan-top",
        SURFACE_PAN_RIGHT: "jtk-surface-pan-right",
        SURFACE_PAN_BOTTOM: "jtk-surface-pan-bottom",
        SURFACE_PAN_ACTIVE: "jtk-surface-pan-active",
        SURFACE_SELECTED_ELEMENT: "jtk-surface-selected-element",
        SURFACE_SELECTED_CONNECTION:"jtk-surface-selected-connection",
        SURFACE_PANNING:"jtk-surface-panning",
        SURFACE_ELEMENT_DRAGGING:"jtk-surface-element-dragging",
        SURFACE_DROPPABLE_NODE:"jtk-surface-droppable-node",
        TOOLBAR: "jtk-toolbar",
        TOOLBAR_TOOL: "jtk-tool",
        TOOLBAR_TOOL_SELECTED: "jtk-tool-selected",
        TOOLBAR_TOOL_ICON: "jtk-tool-icon"
    };

    this.jsPlumbToolkit.Constants = {
        click:"click",
        start:"start",
        stop:"stop",
        drop:"drop",
        disabled:"disabled",
        pan:"pan",
        select:"select",
        drag:"drag",
        left: "left",
        right: "right",
        top: "top",
        bottom: "bottom",
        width: "width",
        height: "height",
        leftmin: "leftmin",
        leftmax: "leftmax",
        topmin: "topmin",
        topmax: "topmax",
        min: "min",
        max: "max",
        nominalSize:"50px",
        px: "px",
        onepx: "1px",
        nopx: "0px",
        em: "em",
        absolute: "absolute",
        relative: "relative",
        none: "none",
        block: "block",
        hidden: "hidden",
        div: "div",
        id: "id",
        plusEquals: "+=",
        minusEquals: "-=",
        dot: ".",
        transform: "transform",
        transformOrigin: "transform-origin",
        nodeType:"Node",
        portType:"Port",
        edgeType:"Edge",
        surfaceNodeDragScope:"surfaceNodeDrag",
        mistletoeLayoutType:"Mistletoe",
        surfaceType:"Surface",
        jtkStatePrefix:"jtk-state-",
        msgCannotSaveState:"Cannot save state",
        msgCannotRestoreState:"Cannot restore state"
    };

    this.jsPlumbToolkit.Attributes = {
        jtkNodeId:"jtk-node-id",
        relatedNodeId:"related-node-id"
    };

    this.jsPlumbToolkit.Methods = {
        addClass:"addClass",
        removeClass:"removeClass"
    };

    this.jsPlumbToolkit.Events = {
        beforeDrop: "beforeDrop",
        beforeDetach: "beforeDetach",
        click: "click",
        canvasClick:"canvasClick",
        canvasDblClick:"canvasDblClick",
        connection: "connection",
        connectionDetached: "connectionDetached",
        connectionMoved:"connectionMoved",
        contentDimensions: "contentDimensions",
        contextmenu: "contextmenu",
        dataLoadStart: "dataLoadStart",
        dataAppendStart:"dataAppendStart",
        dataLoadEnd: "dataLoadEnd",
        dataAppendEnd:"dataAppendEnd",
        dblclick: "dblclick",
        drag: "drag",
        drop:"drop",
        dragover:"dragover",
        dragend:"dragend",
        edgeAdded: "edgeAdded",
        edgeRemoved: "edgeRemoved",
        elementDragged: "elementDragged",
        elementAdded: "elementAdded",
        elementRemoved: "elementRemoved",
        endOverlayAnimation:"endOverlayAnimation",
        graphCleared:"graphCleared",
        modeChanged: "modeChanged",
        mousedown: "mousedown",
        mousemove: "mousemove",
        mouseout: "mouseout",
        mouseup: "mouseup",
        mouseenter: "mouseenter",
        mouseleave: "mouseleave",
        mouseover: "mouseover",
        nodeAdded: "nodeAdded",
        nodeDropped:"nodeDropped",
        nodeMoveStart: "nodeMoveStart",
        nodeMoveEnd: "nodeMoveEnd",
        nodeRemoved: "nodeRemoved",
        edgeTarget: "edgeTarget",
        edgeSource: "edgeSource",
        objectRepainted: "objectRepainted",
        pan: "pan",
        portAdded: "portAdded",
        portRemoved: "portRemoved",
        redraw:"redraw",
        start: "start",
        startOverlayAnimation:"startOverlayAnimation",
        stateRestored:"stateRestored",
        stop: "stop",
        tap: "tap",
        touchend: "touchend",
        touchmove: "touchmove",
        touchstart: "touchstart",
        unload: "unload",
        portRefreshed: "portRefreshed",
        nodeRefreshed: "nodeRefreshed",
        edgeRefreshed: "edgeRefreshed",
        nodeRendered: "nodeRendered",
        nodeUpdated: "nodeUpdated",
        portUpdated: "portUpdated",
        edgeUpdated: "edgeUpdated",
        zoom: "zoom",
        relayout: "relayout",
        deselect:"deselect",
        selectionCleared:"selectionCleared",
        resize:"resize",
        anchorChanged:"anchorChanged"
    };


}).call(this);
;
(function () {
    "use strict";

    var root = this;

    root.jsPlumbToolkit.util = {
        Cookies: {
            get: function (key) {
                var value = document.cookie.match((new RegExp(key + "=[a-zA-Z0-9.()=|%/_]+($|;)", "g")));
                if (!val || val.length == 0)
                    return null;
                else
                    return unescape(val[0].substring(key.length + 1, val[0].length).replace(";", "")) || null;
            },
            set: function (key, value, path, ttl) {
                var c = [ key + "=" + escape(value),
                            "path=" + (!path) ? "/" : path,
                            "domain=" + (!domain) ? window.location.host : domain ],
                    _ttl = function () {
                        if (parseInt(ttl) == 'NaN') return "";
                        else {
                            var now = new Date();
                            now.setTime(now.getTime() + (parseInt(ttl) * 60 * 60 * 1000));
                            return now.toGMTString();
                        }
                    };

                if (ttl)
                    c.push(_ttl(ttl));

                return document.cookie = c.join('; ');
            },
            unset: function (key, path, domain) {
                path = (!path || typeof path != "string") ? '' : path;
                domain = (!domain || typeof domain != "string") ? '' : domain;
                if (root.jsPlumbToolkit.util.Cookies.get(key))
                    root.jsPlumbToolkit.util.Cookies.set(key, '', 'Thu, 01-Jan-70 00:00:01 GMT', path, domain);
            }
        },
        Storage: {
            set: function (key, value) {
                if (typeof localStorage == "undefined")
                    root.jsPlumbToolkit.util.Cookies.set(key, value);
                else {
                    localStorage.setItem(key, value);
                }
            },
            get: function (key) {
                return (typeof localStorage == "undefined") ?
                    root.jsPlumbToolkit.util.Cookies.read(key) :
                    localStorage.getItem(key);
            },
            clear: function (key) {
                if (typeof localStorage == "undefined")
                    root.jsPlumbToolkit.util.Cookies.unset(key);
                else {
                    localStorage.removeItem(key);
                }
            },
            clearAll: function () {
                if (typeof localStorage == "undefined") {
                    // unset all cookies.
                }
                else {
                    while (localStorage.length > 0) {
                        var k = localStorage.key(0);
                        localStorage.removeItem(k);
                    }
                }
            },
            setJSON: function (key, value) {
                if (typeof JSON == "undefined")
                    throw new TypeError("JSON undefined. Cannot store value.");
                root.jsPlumbToolkit.util.Storage.set(key, JSON.stringify(value));
            },
            getJSON: function (key) {
                if (typeof JSON == "undefined")
                    throw new TypeError("JSON undefined. Cannot retrieve value.");
                return JSON.parse(root.jsPlumbToolkit.util.Storage.get(key));
            }
        }
    };
}).call(this);
/**
 * Models a Path - the series of edges and intermediate nodes between two nodes or ports
 * in some toolkit of the Toolkit.
 */
;
(function () {

    "use strict";
    var root = this;
    var JTK = root.jsPlumbToolkit;
    var exports = JTK;

    /**
     * Models the path between two Nodes/Ports, which consists of a series of [Node/Port, Edge] pairs.
     * @class Path
     */
    /**
     * @constructor
     * @param {jsPlumbToolkittoolkit} toolkit toolkit instance from which to get the path info.
     * @param {Object} params Path spec params
     * @param {Node|Port|String} params.source Source node or port, or id of source node/port
     * @param {Node|Port|String} params.target Target node or port, or id of target node/port
     * @param {Boolean} [params.strict=true] Sets whether or not paths are searched strictly by the given source/target. If, for toolkit, you supply a node as the source, but there are only edges connected to ports on that node, by default these edges will be ignored. Switching `strict` to false will mean these edges are considered.
     * @param {Function} [params.nodeFilter] Optional function that is given each Node's backing data and asked to return true or false - true means include the Node, false means exclude it.
     * @param {Function} [params.edgeFilter] Optional function that is given each Edge's backing data and asked to return true or false - true means include the Edge, false means exclude it.
     */
    exports.Path = function (toolkit, params) {

        this.bind = toolkit.bind;
        this.getModel = toolkit.getModel;
        this.setSuspendGraph = toolkit.setSuspendGraph;
        this.getNodeId = toolkit.getNodeId;
        this.getEdgeId = toolkit.getEdgeId;
        this.getPortId = toolkit.getPortId;
        this.getNodeType = toolkit.getNodeType;
        this.getEdgeType = toolkit.getEdgeType;
        this.getPortType = toolkit.getPortType;

        var p = toolkit.getGraph().findPath(params.source, params.target, params.strict, params.nodeFilter, params.edgeFilter),
            deleteEdges = function () {
                // detach all edges in the path
                for (var i = 0; i < p.path.length; i++) {
                    if (p.path[i].edge) {
                        toolkit.removeEdge(p.path[i].edge);
                    }
                }
                return this;
            }.bind(this),
            deleteNodes = function () {
                for (var i = 0; i < p.path.length; i++) {
                    toolkit.removeNode(p.path[i].vertex);
                }
                return this;
            }.bind(this),
            contains = function (obj, doNotFuzzyMatchNodes) {
                var gObj = toolkit.findGraphObject(obj), c = false;
                if (gObj) {
                    for (var i = 0; i < p.path.length; i++) {
                        if (p.path[i].vertex == gObj || p.path[i].edge == gObj || (!doNotFuzzyMatchNodes && p.path[i].vertex.objectType == "Port" && p.path[i].vertex.isChildOf(gObj))) {
                            c = true;
                            break;
                        }
                    }
                }
                return c;
            },
            nodes = [],
            nodeMap = {};

            for (var i = 0; i < p.path.length; i++) {
                nodes.push(p.path[i].vertex);
                nodeMap[toolkit.getNodeId(p.path[i].vertex)] = [ p.path[i].vertex, i ];
            }

        this.getNodes = function() { return nodes; };
        this.getNode = function(obj) {
            return nodeMap[typeof obj === "string" ? obj : obj.id][0];
        };
        this.getAllEdgesFor = function(node) {
            var idx = nodeMap[node.id][1];
            if (idx < p.path.length - 1) {
                return [ p.path[ idx + 1 ].edge ];
            }
            else return [];

        };

        var _each = function (dispatcher, startAt) {
            for (var i = startAt || 0; i < p.path.length; i++) {
                try {
                    dispatcher(i, p.path[i]);
                }
                catch (e) {
                    jsPlumbUtil.log("Path iterator function failed", e);
                }
            }
        };

        /**
         * Iterates through the path one step at a time. Each step consists of an object containing a
         * `vertex`, and, for all entries except the first, an `edge` member, which supplies the Edge that links
         * to the Vertex (which is why it is null for the first entry).
         * @method each
         * @param {Function} fn Function to call for each step. Arguments are `(index, {vertex:v,edge:e})`.
         */
        this.each = function (fn) {
            _each(function (i, p) {
                fn(i, p);
            });
        };

        /**
         * Iterates through the Nodes/Ports in the path one step at a time.
         * @method eachNode
         * @param {Function} fn Function to call for each step. Arguments are `(index, Node|Port)`.
         */
        this.eachNode = function (fn) {
            _each(function (i, p) {
                fn(i, p.vertex);
            });
        };

        /**
         * Iterates through the Edges in the path one step at a time. There is always one fewer Edges than Nodes/Ports.
         * @method eachEdge
         * @param {Function} fn Function to call for each step. Arguments are `(index, Edge)`.
         */
        this.eachEdge = function (fn) {
            _each(function (i, p) {
                fn(i, p.edge);
            }, 1);
        };

        /**
         * Gets the number of Nodes in the Path.
         * @method getNodeCount
         * @return {Integer} Number of Nodes in the Path.
         */
        this.getNodeCount = function () {
            return p.path.length;
        };

        /**
         * Gets the Node at the given index in the path.
         * @method getNodeAt
         * @param idx
         * @returns {*}
         */
        this.getNodeAt = function(idx) {
            return p.path[idx].vertex;
        };

        /**
         * Gets the number of Edges in the Path.
         * @method getEdgeCount
         * @return {Integer} Number of Edges in the Path.
         */
        this.getEdgeCount = function () {
            return p.path.length == 0 ? 0 : p.path.length - 1;
        };

        /**
         * The Path from the underlying Graph. See Graph documentation.
         * @property path
         * @type {Graph.Path}
         */
        this.path = p;

        /**
         * Deletes every Edge in this Path from the underlying Toolkit toolkit.
         * @method deleteEdges
         */
        this.deleteEdges = deleteEdges;

        /**
         * Deletes every Node in this Path from the underlying Toolkit toolkit.  Note that this has the
         * effect of also deleting all the Edges, so this is analogous to #deleteAll.
         * @method deleteNodes
         */
        this.deleteNodes = deleteNodes;

        /**
         * Deletes every object in this Path from the underlying Toolkit toolkit.
         * @method deleteAll
         */
        this.deleteAll = deleteNodes;

        /**
         * Returns whether or not a given path is empty
         * @method isEmpty
         * @return {Boolean} True if path is empty, false otherwise.
         */
        this.isEmpty = function () {
            return p.path.length == 0;
        };

        /**
         * Returns the cost of a given path, computed as the sum of the cost of all of the edges in the path.
         * @method getCost
         * @return {Number} Total cost of the Path. Null if path does not exist.
         */
        this.getCost = function () {
            return p.pathDistance;
        };

        /**
         * Returns whether or not a Path contains the given object.
         * @method contains
         * @param {Node|Port|Edge|String} Node/Port/Edge, or object id, of the element to test for.
         * @param {Boolean} [doNotFuzzyMatchNodes=false] If true, will return true iff a given Node is on the Path. Otherwise,
         * if the test object is a Node that has a Port on the Path, this method will return true.
         * @return {Boolean} True if Path contains the object, false otherwise.
         */
        this.contains = contains;

        /**
         * Returns whether or not a given path exists.
         * @method exists
         * @return {Boolean} True if path exists, false otherwise.
         */
        this.exists = function () {
            return p.pathDistance != null;
        };

        /**
         * Select a set of edges.
         * @method selectEdges
         * @param {Object} params parameters for the select call
         * @param {Node|String} [params.source] Source Node or id of source Node from which to select Edges.
         * @param {Node|String} [params.target] Target Node or id of target Node from which to select Edges.
         */
        this.selectEdges = function (params) {
            return _selectEdges(params, "getEdges", false);
        };

        /**
         * Select all edges in the toolkit toolkit.
         * @method selectAllEdges
         * @param {Object} params Parameters for the selectAllEdges call.
         */
        this.selectAllEdges = function (params) {
            return _selectEdges(params, "getAllEdges", true);
        };
    };


}).call(this);

/*
 * IO
 *
 * copyright 2014 jsPlumb
 * http://jsplumbtoolkit.com
 *
 * Licensed under the GPL2 license.  This software is not free.
 *
 * This file contains IO support - loading/saving of the internal JSON format used by the Toolkit (and also support for custom formats)
 *
 */

/*
 DOM:

 - no knowledge of the DOM.

 DEPENDENCIES:

 jsPlumbUtil
 */
;
(function () {

    "use strict";

    var root = this;
    var exports = root.jsPlumbToolkitIO = {};
    var JUTIL = jsPlumbUtil;

    exports.version = "0.1";
    exports.name = "jsPlumbToolkitIO";

    /*
     This uses the toolkit's internal JSON format.
     */
    var JSONGraphParser = function (data, toolkit, parameters) {
            var nodes = data.nodes || [],
                edges = data.edges || [],
                ports = data.ports || [];

            for (var i = 0; i < nodes.length; i++) {
                toolkit.addNode(nodes[i]);
            }

            for (var k = 0; k < ports.length; k++) {
                var n = toolkit.getNode(ports[k].nodeId);
                if (n == null)
                    throw new TypeError("Unknown node [" + ports[k].nodeId + "]");
                n.addPort(ports[k]);
            }

            for (var j = 0; j < edges.length; j++) {
                var c = edges[j].cost || 1;

                toolkit.addEdge({
                    source: edges[j].source,
                    target: edges[j].target,
                    cost: c,
                    directed: edges[j].directed,
                    data: edges[j].data
                });
            }
        },
        JSONGraphExporter = function (toolkit, parameters) {
            return toolkit.getGraph().serialize();
        };

    // parser for the "hierarchical json" format
    var hierarchicalJsonParser = function (data, toolkit, parameters) {
        var _one = function (d) {
            var n = toolkit.addNode(d);
            if (d.children) {
                for (var i = 0; i < d.children.length; i++) {
                    var c = toolkit.addNode(d.children[i]);
                    toolkit.addEdge({source: n, target: c});
                    _one(d.children[i]);
                }
            }
        };
        _one(data);
    };

    exports.exporters = {
        "json": JSONGraphExporter
    };

    exports.parsers = {
        "json": JSONGraphParser,
        "hierarchical-json": hierarchicalJsonParser
    };

    exports.managers = {
        "json": {
            "removeNode": function (dataset, node, idFunction) {
                var id = idFunction(node.data);
                JUTIL.removeWithFunction(dataset.nodes, function (n) {
                    return n.id == id;
                });
            },
            "removeEdge": function (dataset, edge, idFunction) {
                var id = idFunction(edge.data);
                JUTIL.removeWithFunction(dataset.edges, function (e) {
                    return e.data && (e.data.id == id);
                });
            },
            "addNode": function (dataset, node, idFunction) {
                dataset.nodes = dataset.nodes || [];
                dataset.nodes.push(node.data);
            },
            "addEdge": function (dataset, edge, idFunction) {
                var j = {
                    source: edge.source.getFullId(),
                    target: edge.target.getFullId(),
                    data: edge.data || {}
                };
                dataset.edges = dataset.edges || [];
                dataset.edges.push(j);
            },
            "addPort": function (dataset, params, idFunction) {
                dataset.ports = dataset.ports || [];
                var d = jsPlumb.extend({}, params.port.data || {});
                d.id = params.port.getFullId();
                dataset.ports.push(d);
            },
            "removePort": function (dataset, params, idFunction) {
                var id = params.port.getFullId();
                JUTIL.removeWithFunction(dataset.ports, function (p) {
                    return p.id == id;
                });
            }
        }
    };

    exports.parse = function (type, source, toolkit, parameters) {
        var parser = exports.parsers[type];
        if (parser == null)
            throw new Error("jsPlumb Toolkit - parse - [" + type + "] is an unsupported type");
        else
            return parser(source, toolkit, parameters);
    };

    exports.exportData = function (type, toolkit, parameters) {
        var exporter = exports.exporters[type];
        if (exporter === null)
            throw new Error("jsPlumb Toolkit - exportData - [" + type + "]  is an unsupported type");
        else
            return exporter(toolkit, parameters);
    };

    exports.manage = function (operation, dataset, dataType, obj, idFunction, toolkit) {
        if (exports.managers[dataType] && exports.managers[dataType][operation]) {
            exports.managers[dataType][operation](dataset, obj, idFunction);
        }
    };

}).call(this);

;
(function () {

    var root = this;
    var JTK = root.jsPlumbToolkit;
    var exports = JTK;

    /**
     * Support functionality for working with existing jsPlumb instances in the Toolkit. Using the `ingest` method in this
     * class, you can ingest an existing jsPlumb instance into a new instance of the Toolkit; this for many people may
     * prove to be a logical upgrade path from their existing jsPlumb code.
     *
     * When you ingest an existing jsPlumb instance, its `Container` is configured to be a `Surface` widget, which makes
     * it pannable and zoomable, and the set of Nodes and Edges it is managing are loaded into the Toolkit's data model.
     * @class jsPlumbToolkit.Support
     */
    exports.Support = {

        /**
         * Ingests an existing jsPlumb instance into a new Toolkit instance, and turns the instance's Container into a Surface.  Every element
         * that is the source or target of a Connection is added to the Toolkit instance as a Node, and every Connection is added as an Edge. You
         * can provide your own functions for determining the `id` and `type` of Nodes and Edges, if you need to. This method will throw an error
         * if your jsPlumb instance does not have a Container set; it is a requirement for the Surface widget.
         * @method ingest
         * @static
         * @param {Object} params Method parameters.
         * @param {jsPlumbInstance} [params.jsPlumb] The instance of jsPlumb to ingest. If null, it uses the static jsPlumb window instance.
         * @param {String} [params.nodeSelector] Optional selector to identify elements that may not yet be managed by jsPlumb but which you would like to have imported as Nodes.
         * @param {Function} [params.idFunction] A function to use to extract the id from elements that are being loaded as Nodes. If null,
         *                                       the default behaviour is to ask the jsPlumb instance for the element's `id` attribute.
         * @param {Function} [params.typeFunction] A function to use to extract the type from elements that are being loaded as Nodes. If null,
         *                                       the default behaviour is to use `default` as the Node type.
         * @param {Function} [params.edgeIdFunction] A function to use to extract the id from Connections that are being loaded as Edges. If null,
         *                                       the default behaviour is to use the Connection's `id`.
         * @param {Function} [params.edgeTypeFunction] A function to use to extract the type from Connections that are being loaded as Edges. If null,
         *                                       the default behaviour is to use `default` as the Edge type.
         * @param {Object} [params.renderParams] Parameters to pass to the Surface constructor.
         * @param {Boolean} [params.render=true] If false, this method returns only a Toolkit instance with data loaded, and doesn't create a Surface renderer for it.
         * @return {jsPlumbToolkitInstance|Surface} A Surface instance whose underlying Toolkit has been loaded with the contents of the jsPlumb instance (you can access the Toolkit itself via `surface.getToolkit()`), or, if `render` was set to false, a `jsPlumbToolkitInstance`..
         */
        ingest: function (params) {
            var _jsPlumbInstance = params.jsPlumb || root.jsPlumb;
            if (!_jsPlumbInstance.getContainer()) throw new TypeError("No Container set on jsPlumb instance. Cannot continue.");
            var tk = JTK.newInstance(),
                conns = _jsPlumbInstance.select(),
                nMap = {},
                _defaultFunction = function () {
                    return "default";
                },
                idFunction = params.idFunction || function (el) {
                    return _jsPlumbInstance.getId(el);
                },
                typeFunction = params.typeFunction || _defaultFunction,
                edgeIdFunction = params.idFunction || function (c) {
                    return c.id;
                },
                edgeTypeFunction = params.edgeTypeFunction || _defaultFunction,
                render = params.render !== false;

            var _addNode = function (el) {
                var id = idFunction(el), type = typeFunction(el);
                var elId = _jsPlumbInstance.getId(el);
                if (nMap[elId] == null) {
                    nMap[elId] = tk.addNode({id: id, type: type}, null, true);
                    el.jtk = { node: nMap[elId] };
                }
            };

            var _addEdge = function (conn) {
                var ourSource = nMap[conn.sourceId], ourTarget = nMap[conn.targetId],
                    id = edgeIdFunction(conn), type = edgeTypeFunction(conn);

                conn.edge = tk.addEdge({source: ourSource, target: ourTarget, data: { id: id, type: type }}, null, true);
            };

            // extra nodes
            if (params.nodeSelector) {
                var selectorNodes = _jsPlumbInstance.getContainer().querySelectorAll(params.nodeSelector);
                for (var i = 0; i < selectorNodes.length; i++) {
                    var id = _jsPlumbInstance.getId(selectorNodes[i]);
                    _addNode(selectorNodes[i], id);
                    _jsPlumbInstance.manage(id, selectorNodes[i]);
                }
            }

            // nodes
            var managedElements = _jsPlumbInstance.getManagedElements();
            for (var id in managedElements) {
                _addNode(managedElements[id].el, id);
            }

            // edges
            conns.each(function (conn) {
                _addEdge(conn);
            });

            // now the data has been loaded. if render==false, return the toolkit
            if (!render)
                return tk;
            else {
                var rp = root.jsPlumb.extend({}, params.renderParams || {});
                rp.jsPlumbInstance = _jsPlumbInstance;
                rp.container = _jsPlumbInstance.getContainer();
                var renderer = tk.render(rp);

                renderer.ingest = function(el) {
                    _addNode(el);
                    renderer.importNode(el, idFunction(el));
                };

                return renderer;
            }
        }
    };

}).call(this);

/*
 * jsPlumbToolkit
 *
 * copyright 2013 morrisonpitt.com
 * http://morrisonpitt.com
 *
 * Licensed under the GPL2 license.  This software is not free.
 *
 * This file contains the layouts supported by the Toolkit.
 *
 */

/*
 DOM:

 knows about the DOM, sort of, through jsPlumbUtil's `extend` and`EventGenerator`.

 DEPENDENCIES

 - jsPlumbUtil

 */

;
(function () {

    "use strict";

    var root = this;
    var JTK = root.jsPlumbToolkit;
    var exports = JTK.Layouts = {
        Decorators: {}
    };
    var JUTIL = jsPlumbUtil;

// common utility functions

    var //
    // gets the bounding box for all positioned elements.  this is in the coord space of the layout in use, and
    // may differ from pixels coords.  it is mapped by the updateUIPosition function to pixel space.
    //
        getBoundingBox = function (positions) {
            var xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
            for (var i in positions) {
                xmin = Math.min(xmin, positions[i][0]);
                xmax = Math.max(xmax, positions[i][0]);
                ymin = Math.min(ymin, positions[i][1]);
                ymax = Math.max(ymax, positions[i][1]);
            }
            return [
                [ xmin, ymin ],
                [ xmax, ymax ],
                Math.abs(xmin - xmax),
                Math.abs(ymin - ymax)
            ];
        },
        _initialiseDecorators = function (dlist) {
            if (dlist == null) return [];
            var out = [];
            var _resolve = function (d) {
                var fnName = (typeof d == "string") ? d : d[0],
                    fn = exports.Decorators[fnName],
                    fnParams = (typeof d == "string") ? {} : d[1];

                if (!fn) {
                    throw new TypeError("Decorator [" + fnName + "] no registered on jsPlumbToolkit.Layouts.Decorators");
                }
                return new fn(fnParams);
            };
            for (var i = 0; i < dlist.length; i++)
                out.push(_resolve(dlist[i]));

            return out;
        };

    /**
     * The parent for all layouts. This class maintains an array of element positions and
     * sizes, and provides the key methods for executing layout functionality.  When using the Toolkit
     * you will not ordinarily need to interact directly with a layout, but if you write your own layout
     * then you need to extend this class and implement the abstract methods you need.
     *
     * ##### Custom Layouts
     *
     * The general syntax for writing a custom layout is to call `AbstractLayout`'s constructor and assign the
     * return value to a variable:
     *
     * ```
     * jsPlumbToolkit.Layouts["MyLayout"] = function(params) {
    *   var _super = jsPlumbToolkit.Layouts.AbstractLayout.apply(this, arguments);
    *   ...
    *  };
    * ```
    *
    * ##### Lifecycle
    *
    * The lifecycle of a layout - controlled by this class - is as follows:
     *
     * - `begin(_jsPlumbToolkit, parameters)` This is an optional method.
     * - `step(_jsPlumbToolkit, parameters)` This is called repeatedly until your code has indicated that the layout is complete (see below)
     * - `end(_jsPlumbToolkit, parameters)` Also an optional method.
     *
     * ##### Layout Completion
     *
    * You are required to inform the superclass when your layout is complete, via this method:
     *
     * ```
     * _super.setDone(true);
     * ```
     *
     * #### Other Optional Methods
     * Your layout can implement several optional methods should you need finer grained control of the lifecycle:
     *
     * - `_nodeAdded` - Notification that a new Node was added to the dataset.
     * - `_nodeRemoved` - Notification that a new Node was added to the dataset.
     * - `_nodeMoved` - Notification that a Node was moved.
    *
    * @class Layouts.AbstractLayout
     * @abstract
     * @constructor
     * @param {Object} params Constructor parameters
     * @param {Boolean} [params.draggable=true] Whether or not elements should be draggable.
     * @param {Object} [params.dragOptions] Drag options to set on individual elements.
     */
    exports.AbstractLayout = function (params) {
        params = params || {};
        var self = this,
            _defaultParameters = function () {
                return { padding: [0, 0] }
            },
        // this takes the current value of 'parameters' and merges it on top of any default param
        // values declared by the layout, then assigns those to the parameters object.
        // it is called at 'begin'
            _prepareParameters = function () {
                var p = root.jsPlumb.extend(_defaultParameters(), self.defaultParameters || {});
                root.jsPlumb.extend(p, parameters || {});
                parameters = p;
            },
            adapter = params.adapter,
            parameters = params.parameters || {},
            getElementForNode = params.getElementForNode,
            magnetizer = new Magnetizer({
                getPosition: function (o) {
                    var p = positions[o.id];
                    return { left: p[0], top: p[1] };
                },
                getSize: function (o) {
                    return sizes[o.id];
                },
                getId: function (o) {
                    return o.id;
                },
                setPosition: function (o, p) {
                    _setPosition(o.id, p.left, p.top);
                },
                padding: parameters.padding,
                filter:function(id) {
                    return self.canMagnetize ? self.canMagnetize(id) : true;
                }
            }),
            magnetize = params.magnetized === false ? false : (self.defaultMagnetized || params.magnetize === true);

        this.decorators = _initialiseDecorators(params.decorators);
        this.adapter = params.adapter;

        var _jsPlumb = params.jsPlumb || root.jsPlumb,
            _jsPlumbToolkit = params.jsPlumbToolkit,
        // this x,y location of every element.  all layouts write to this.
        // this is a map whose keys are node ids and whose values are [x,y] positions.  access to it is restricted
        // to the 'getPosition' method, which creates an entry for the given node if one does not yet exist.
            positions = {},
            positionArray = [],
            _minx = Infinity, _miny = Infinity, _maxx = -Infinity, _maxy = -Infinity,
            _nodes = {},
            sizes = {},
            container = params.container,
            containerSize = _jsPlumb.getSize(container),
            width = (params.width || containerSize[0]),
            height = (params.height || containerSize[1]),
            done = false,
            _reset = function () {
                done = false;
                _minx = Infinity;
                _maxx = -Infinity;
                _miny = Infinity;
                _maxy = -Infinity;
                // clear decoration
                for (var i = 0; i < self.decorators.length; i++)
                    self.decorators[i].reset({remove: _jsPlumb.remove});
                positions = {};
                positionArray.splice(0);
                sizes = {};
                self.reset && self.reset();
            };

        /**
         * Magnetize the display. You must indicate what sort of magnetization you wish to perform: if you provide an event,
         * the event's location will be the magnetization origin. If you provide `origin:{left;xxx, top:xxx}`, that value will be used. If
         * you provide neither, the computed center of all elements will be used. You can also provide an `options:{...}` value, whose
         * values can contain `filter`, `constrain` and `padding` values for the specific run of the magnetizer.
         * @param {Object} [params] Magnetize parameters. If ommitted, the origin of magnetization will be the computed center of all the elements.
         * @param {Event} [params.event] If provided, the event location will be used as the origin of magnetization.
         * @param {Object} [params.origin] An object with `left` and `top` properties. If provided, will be used as the origin of magnetization.
         * @param {Object} [params.options] Extra magnetizer options for this run of the magnetizer.
         */
        this.magnetize = function (params) {
            params = params || {};
            var fn = params.event ? "executeAtEvent" : params.origin ? "execute" : "executeAtCenter";
            var args = params.event ? [params.event, params.options] : params.origin ? [params.origin, params.options] : [params.options];
            magnetizer[fn].apply(magnetizer, args);
            _draw(_jsPlumb.repaintEverything);
        };

        /**
         * Called by components to inform a layout that a new node was added. You should never
         * call this method directly. Also, you should not override this method in a custom layout: if your layout
         * needs to track node addition, implement `_nodeAdded` instead.
         * @method nodeAdded
         * @param {Object} params Method args
         * @param {Node} params.node Node that was added
         * @param {Element} params.el The DOM element associated with the Node.
         * @param {Object} [eventInfo] Optional information associated with the Event that the host system needs to pass through without adding to the data model.
         */
        this.nodeAdded = function (params, eventInfo) {
            // stash position and size for this node.
            var up = eventInfo && eventInfo.position ? eventInfo.position :params.node.data && params.node.data.left && params.node.data.top ? params.node.data : self.adapter.getOffset(params.el);
            if (this._nodeAdded) {
                var newPosition = this._nodeAdded(params, eventInfo);
                if (newPosition) {
                    up.left = newPosition[0];
                    up.top= newPosition[1];
                }
            }
            _nodes[params.node.id] = params.node;
            _setPosition(params.node.id, up.left, up.top);
            _getSize(params.node.id, params.el);
            magnetizer.addElement(params.node);
        };

        /**
         * Optional method for subclasses to override should they wish to be informed of node addition.
         * @method _nodeAdded
         * @param {Object} params Method args
         * @param {Node} params.node Node that was added
         * @param {Object} params.data Data associated with the Node
         * @param {Element} params.el The DOM element associated with the Node.
         */

        /**
         * Called by components to inform a layout that a given node was removed. You should never
         * call this method directly.
         * @method nodeRemoved
         * @param {String} nodeId  Id of the the node that was removed.
         */
        this.nodeRemoved = function (nodeId) {
            delete positions[nodeId];
            delete sizes[nodeId];
            delete _nodes[nodeId];
            if (this._nodeRemoved) this._nodeRemoved(nodeId);
            magnetizer.removeElement(params.node);
        };

        /**
         * Optional method for subclasses to implement if they wish to be informed of node removal.
         * @method _nodeRemoved
         * @param {String} nodeId  Id of the the node that was removed.
         */

        /**
         * Optional method for subclasses to implement if they wish to be informed of a node having moved.
         * @method _nodeMoved
         * @param {String} nodeId  Id of the the Node that was moved.
         * @param {Number} x New X location of the Node.
         * @param {Number} y New Y location of the Node.
         */

        /**
         * Gets the size of the node with given id, caching it for later use.
         * @method getSize
         * @param {String} id ID of the node to retrieve size for.
         * @return {Number[]} Width and height of the Node in an array.
         */
        var _getSize = function (id, n) {
                var s = sizes[id];
                if (!s) {
                    n = n || getElementForNode(id);
                    if (n != null) {
                        s = _jsPlumb.getSize(n);
                        sizes[id] = s;
                    }
                    else
                        s = [0, 0];
                }
                return s;
            },
            /**
             * Gets the position of the node with given id, creating it (as a random value) if null and optionally setting values.
             * note this method does a 'pass by reference' thing as the return value - any changes you make will
             * be used by the final layout step (this is a good thing). Note that here it is fine to work with
             * the node's id, as we are not going anywhere near a DOM element yet. When it comes time to
             * actually set a DOM element's position, we use the supplied `getElementForNode` function to
             * get it.  And of course note also that we are not necessarily dealing with DOM elements.
             * @method getPosition
             * @param {String} id ID of the Node to retrieve the position for
             * @param {Number} [x] Optional X location for the Node if its position has not yet been set.
             * @param {Number} [y] Optional Y location for the Node if its position has not yet been set.
             * @param {Boolean} [doNotRandomize=false] If true, won't set a random position for an element whose position is not yet being tracked.
             */
            _getPosition = function (id, x, y, doNotRandomize) {
                var p = positions[id];
                if (!p) {
                    if (x != null && y != null)
                        p = [x, y];
                    else if (!doNotRandomize)
                        p = [Math.floor(Math.random() * (width + 1)), Math.floor(Math.random() * (height + 1))];
                    else return null;

                    _setPosition(id, p[0], p[1]);
                }
                return p;
            },
            _updateMinMax = function (p) {
                _minx = Math.min(_minx, p[0]);
                _miny = Math.min(_miny, p[1]);
                _maxx = Math.max(_maxx, p[0]);
                _maxy = Math.max(_maxy, p[1]);
            },
            /**
             * Sets the Position of the Node with the given ID.
             * @method setPosition
             * @param {String} id ID of the Node to set the position for
             * @param {Number} x X location for the Node.
             * @param {Number} y Y location for the Node.
             */
            _setPosition = this.setPosition = function (id, x, y, updateMove) {
                var p = positions[id];
                if (!p) {
                    p = positions[id] = [ parseFloat(x), parseFloat(y) ];
                    positionArray.push([p, id]);
                }
                else {
                    p[0] = parseFloat(x);
                    p[1] = parseFloat(y);
                }

                _updateMinMax(p);
                if (updateMove && self._nodeMoved) self._nodeMoved(id, x, y);
            },
        /*
         * Gets a random position for the Node with the given ID.
         * @param {String} id ID of the Node to get a random position for
         * @param {Number} [w] Optional max width constraint for the value. Defaults to 10.
         * @param {Number} [h] Optional max height constraint for the value. Defaults to 10.
         * @returns {Number[]} [x,y] position for the Node.
         * @private
         */
            _getRandomPosition = function (id, w, h) {
                w = w || 10;
                h = h || 10;
                var p = positions[id];
                if (!p) {
                    p = positions[id] = [];
                }
                p[0] = Math.floor(Math.random() * w);
                p[1] = Math.floor(Math.random() * h);
                _updateMinMax(p);
                return p;
            },
            dumpPos = function () {
                for (var e in positions)
                    console.log(e, positions[e][0], positions[e][1]);
            },
            _positionNode = function (nodeId, onComplete) {
                var el = getElementForNode(nodeId);

                if (el != null) {
                    var o = positions[nodeId];
                    self.adapter.setAbsolutePosition(el, o, onComplete);
                    savedPositions[nodeId] = [ o[0], o[1] ];
                    return o.concat(_getSize(nodeId));
                }

                return null;
            }.bind(this),

            _draw = this.draw = function (onComplete) {
                for (var e in positions) {
                    var o = _positionNode(e);
                    if (o != null) {
                        _minx = Math.min(o[0], _minx);
                        _miny = Math.min(o[1], _miny);
                        _maxx = Math.max(o[0] + o[2], _maxx);
                        _maxy = Math.max(o[1] + o[3], _maxy);
                    }
                }

                for (var i = 0; i < self.decorators.length; i++) {
                    self.decorators[i].decorate({
                        adapter: self.adapter,
                        layout: self,
                        append: function(el, id, pos) {
                            self.adapter.append(el, id, pos, true);
                        },
                        setAbsolutePosition: self.adapter.setAbsolutePosition,
                        toolkit: _jsPlumbToolkit,
                        jsPlumb: _jsPlumb,
                        bounds: [_minx, _miny, _maxx, _maxy],
                        floatElement:self.adapter.floatElement,
                        fixElement:self.adapter.fixElement
                    });
                }
                onComplete && onComplete();
            },
            bb = function (msg) {
                console.log(msg);
                var b = getBoundingBox(positions, _getSize, getElementForNode);
                dumpPos();
                console.log(b[0], b[1], b[2], b[3]);
            };

        // debug
        this.bb = bb;

        var getPositions = this.getPositions = function () {
            return positions;
        };
        var getPosition = this.getPosition = function (id) {
            return positions[id];
        };
        var savedPositions = {};

        var getSize = this.getSize = function(id) {
            return sizes[id];
        };

        /**
         * This is an abstract function that subclasses may implement if they wish. It will be called at the beginning of a layout.
         * @method begin
         * @abstract
         * @param {jsPlumbToolkitInstance} _jsPlumbToolkit The associated jsPlumbToolkit instance
         * @param {Object} parameters Parameters configured for the layout.
         */
        this.begin = function (_jsPlumbToolkit, parameters) { };

        /**
         * This is an abstract function that subclasses may implement if they wish. It will be called at the end of a layout.
         * @method end
         * @abstract
         * @param {jsPlumbToolkitInstance} _jsPlumbToolkit The associated jsPlumbToolkit instance
         * @param {Object} parameters Parameters configured for the layout.
         */
        this.end = function (_jsPlumbToolkit, parameters) { };

        // private method that actually runs the layout.
        var _layout = function (onComplete) {
            if (_jsPlumbToolkit == null) return;
            _prepareParameters();
            magnetizer.setElements(adapter.getNodes());
            this.begin && this.begin(_jsPlumbToolkit, parameters);

            var _end = function () {
                _draw(function () {
                    if (magnetize) {
                        self.magnetize();
                    }

                    self.end && self.end(_jsPlumbToolkit, parameters);

                    onComplete();
                });
            };

            while (!done) {
                this.step(_jsPlumbToolkit, parameters);
            }

            _end();

        }.bind(this);

        /**
         * Runs the layout, first doing a reset of element positions. Next, if the subclass has defined a `begin` method, that will
         * be called first.  Then, the subclass's `step` method will be called repeatedly, until the subclass makes a call to `_super.setDone`.
         * Use the `layout` method to run the layout incrementally without first resetting everything.
         * @method relayout
         * @param {Object} [newParameters]  Optional new set of parameters to apply.
         * @param {Function} [onComplete] Optional function to call on completion of relayout.
         */
        this.relayout = function (newParameters, onComplete) {
            _reset();
            if (newParameters != null)
                parameters = newParameters;
            _layout(onComplete);
        };

        /**
         * Runs the layout, without resetting calculated or user-provided positions beforehand.
         * If the subclass has defined a `begin` method, that will be called first.  Then, the subclass's
         * `step` method will be called repeatedly, until the subclass makes a call to `_super.setDone`.
         * @method layout
         */
        this.layout = function (onComplete) {
            done = false;
            _layout(onComplete);
        };

        /**
         * Resets user-supplied and calculated positions.
         * @method clear
         */
        this.clear = function () {
            _reset();
        };

        return {
            adapter: params.adapter,
            jsPlumb: _jsPlumb,
            toolkit: _jsPlumbToolkit,
            getPosition: _getPosition,
            setPosition: _setPosition,
            getRandomPosition: _getRandomPosition,
            getSize: _getSize,
            getPositions: getPositions,
            setPositions: function (p) {
                positions = p;
            },
            width: width,
            height: height,
            reset: _reset,
            draw: _draw,
            setDone: function (d) {
                done = d;
            }
        };
    };

    /**
     * A layout that does very little beyond implementing the functions present in the layout API
     * @class Layouts.EmptyLayout
     * @extends Layouts.AbstractLayout
     */
    exports.EmptyLayout = function (adapter) {
        var positions = {};
        this.refresh =
            this.relayout =
                this.layout = function () {
                    // here we assign 0,0 to everything.
                    this.clear();
                    var vc = adapter.getNodeCount();
                    for (var i = 0; i < vc; i++) {
                        var v = adapter.getNodeAt(i);
                        positions[v.getFullId()] = [0, 0];
                    }
                };

        this.nodeRemoved = function (node) {
            delete positions[node.id];
        };
        this.nodeAdded = function (node) {
            positions[node.id] = false;
        };

        this.getPositions = function () {
            return positions;
        };
        this.getPosition = function (id) {
            return positions[id];
        };
        this.setPosition = function (id, x, y) {
            positions[id] = [x, y];
        };

        this.clear = function () {
            positions = {};
        };
    };

    /**
     * Mistletoe layout grows on another layout and does nothing except override lifecycle events and then
     * update itself once all the hard work has been done. It is used by the Miniview component.
     * @class Layouts.Mistletoe
     * @extends Layouts.AbstractLayout
     * @constructor {Object} params Constructor parameters
     * @param {Layouts.AbstractLayout} params.layout The layout on which to leech.
     */
    exports.Mistletoe = function (params) {
        if (!params.parameters.layout) throw ("No layout specified for MistletoeLayout");
        var _map = {};
        var p = root.jsPlumb.extend({}, params);
        p.getElementForNode = function (nId) {
            return _map[nId];
        };

        var _super = exports.AbstractLayout.apply(this, [p]),
            layout = params.parameters.layout,
            _redraw = function () {
                _super.setPositions(layout.getPositions());
                _super.draw();
                this.fire("redraw");
            }.bind(this),
        // original refs
            _layout, _relayout, _clear;

        JUTIL.EventGenerator.apply(this, arguments);

        this.map = function (nodeId, el) {
            _map[nodeId] = el;
        };

        var _attach = function () {
            _map = {}, _layout = layout.layout, _relayout = layout.relayout, _clear = layout.clear;
            layout.layout = function () {
                _layout.apply(layout, arguments);
                _redraw();
            };

            layout.relayout = function () {
                _super.reset();
                _relayout.apply(layout, arguments);
                _redraw();
            };

            layout.clear = function () {
                _clear.apply(layout, arguments);
                _super.reset();
            };
        };

        _attach();

        /**
         * Set the layout on which to base this layout.
         */
        this.setHostLayout = function (l) {
            layout = l;
            _attach();
        };
    };

    /**
     * Mixin for layouts that have an absolute backing.  This includes, of course, the `Absolute` layout,
     * which is actually just a direct reference to this class.
     * The default behaviour is to look for a `left` and `top` member in each node, but you
     * can supply a `locationFunction` parameter to the constructor to derive your own
     * position from each node.
     * @class Layouts.AbsoluteBackedLayout
     * @extends Layouts.AbstractLayout
     * @constructor
     * @param {Object} params Constructor parameters
     * @param {Function} [params.locationFunction] Takes a Node and returns an [x,y] array indicating
     * the location of the given Node. The backing data for a Node is available as the `data` property.
     */
    var AbsoluteBackedLayout = exports.AbsoluteBackedLayout = function (params) {
        params = params || {};
        var _super = exports.AbstractLayout.apply(this, arguments);
        var _defaultLocationFunction = function (n) {
            return [ n.data.left, n.data.top ];
        };
        var _findLocation = function(v, parameters) {
            return (params.locationFunction || _defaultLocationFunction)(v);
        };

        this.begin = function (toolkit, parameters) {
            var count = _super.adapter.getNodeCount();

            for (var i = 0; i < count; i++) {
                var v = _super.adapter.getNodeAt(i),
                    id = toolkit.getNodeId(v.data),
                    p = _super.getPosition(id, null, null, true);

                // if no position yet tracked, get it from the data.
                if (p == null)
                    p = _findLocation(v, parameters);

                this.setPosition(id, p[0], p[1], true);
            }
        };

        // override _nodeAdded so we can set initial pos
        this._nodeAdded = function(nodeAddParams, eventInfo) {
            return _findLocation(nodeAddParams.node, params.parameters || {});
        };

        /**
         * Gets the position for the given Node as dictated by either the `left`/`top` properties, or some other nominated pair, in the node's data.
         * This position is what the Absolute layout uses itself, and this method exposes the absolute position for subclasses that wish to make use
         * of the absolute backing.
         * @param {Node} v Node to get absolute position for.
         * @param {Object} parameters Constructor parameters. May contain a custom `locationFunction`.
         * @returns {Number[]}
         */
        this.getAbsolutePosition = function(v, parameters) {
            return _findLocation(v, parameters);
        };

        this.step = function () {
            _super.setDone(true); // all the work was done in 'begin'
        };

        return _super;
    };
    JUTIL.extend(AbsoluteBackedLayout, exports.AbstractLayout);

    /**
     * This layout places elements with absolute positioning. The default is to look for a `left` and `top`
     * member in each node, but you can supply your own `locationFunction` parameter to the constructor to
     * derive your own position from each node.
     * @class Layouts.Absolute
     * @extends Layouts.AbsoluteBackedLayout
     * @constructor
     * @param {Object} params Constructor parameters
     * @param {Function} [params.locationFunction] Takes node data and returns an [x,y] array indicating the location of the given Node.
     */
    exports.Absolute = function (params) {
        exports.AbsoluteBackedLayout.apply(this, arguments);
    };
    JUTIL.extend(exports.Absolute, exports.AbsoluteBackedLayout);

    /**
     * Mixin for hierarchical layouts (those that expect a root node). This class takes care of
     * putting `rootNode` and `root` values in the parameters that are subsequently passed into the
     * various lifecycle methods of the layout. The root node is the first node found in the Graph (ie the first node
     * you added to the Graph)
     * @class Layouts.AbstractHierarchicalLayout
     * @extends Layouts.AbstractLayout
     * @constructor
     * @param {Object} params Constructor parameters
     * @param {Boolean} [params.ignoreLoops=true] Whether or not to ignore loops in the layout. When false,
     * an exception will be thrown if a loop is found.
     * @param {Function} [params.getRootNode] Optional function that can return the node that should be the root
     * of the hierarchy. If this is not provided then the first Node in the Toolkit is used.
     * @param {Function} [params.getChildNodes] Optional function to be used to get child nodes for each node. The
     * default is simply to look for Nodes that are targets of an Edge from the focus Node.
     */
    var AbstractHierarchicalLayout = exports.AbstractHierarchicalLayout = function (params) {
        var self = this,
            _super = exports.AbstractLayout.apply(this, arguments);

        self.begin = function (toolkit, parameters) {
            parameters.ignoreLoops = !(params.ignoreLoops === false);
            parameters.getRootNode = parameters.getRootNode || function(toolkit) {
                if (_super.adapter.getNodeCount() > 0) {
                    return _super.adapter.getNodeAt(0);
                }
            };
            parameters.getChildEdges = parameters.getChildEdges || function(node, toolkit) {
                return _super.toolkit.getAllEdgesFor(node, function(e) {
                    return e.source === node;
                });
            };
            parameters.rootNode = parameters.getRootNode(toolkit);
            if (parameters.rootNode) {
                parameters.root = parameters.rootNode.id;
            }
            else
                _super.setDone(true);
        };

        return _super;
    };
    JUTIL.extend(AbstractHierarchicalLayout, exports.AbstractLayout);

}).call(this);

/**
 * @name jsPlumbToolkit.Layouts.Circular
 * @desc Provides a circular layout.
 */
/**
 * @constructor
 * @param {Object} params Constructor parameters
 * @param {Integer} [params.padding=30] Minimum distance between a node and its neighbours. Defaults to 30 pixels.
 */
;
(function () {

    "use strict";

    var root = this;
    var JTK = root.jsPlumbToolkit;
    var exports = JTK.Layouts;

    exports.Circular = function (params) {
        params = params || {};
        var _super = exports.AbstractLayout.apply(this, arguments);

        this.defaultParameters = {
            padding: 30,
            locationFunction:params.locationFunction
        };

        this.step = function (toolkit, parameters) {
            var nodeCount = _super.adapter.getNodeCount();

            if (nodeCount == 0) {
                _super.setDone(true);
                return;
            }

            var x = 0, y = 0, i, n,
                radius = 10,
                degreesPerNode = 2 * Math.PI / nodeCount,
                curDegree = -Math.PI / 2;

            // The basic algorithm is to set a radius of 1 and assign a center to each of the elements, and as
            // we go along we keep track of the largest element. Then, we re-calculate the radius of the circle
            // as if all the elements were as large as the largest one. We can do that by drawing a box whose
            // dimensions are as big as the largest node at loc 0,0.  Then we draw the same box, rotated by
            // however many degrees separate each node from the next (360 / nodeCount)
            for (i = 0; i < nodeCount; i++) {
                n = _super.adapter.getNodeAt(i);
                _super.setPosition(n.id, x + (Math.sin(curDegree) * radius), y + (Math.cos(curDegree) * radius), true);
                curDegree += degreesPerNode;
            }

            // take the first one, and the one next to it, and pad the second one.
            var n1 = _super.adapter.getNodeAt(0),
                s1 = _super.getSize(n1.id),
                p1 = _super.getPosition(n1.id),
                r1 = {
                    x: p1[0] - parameters.padding,
                    y: p1[1] - parameters.padding,
                    w: s1[0] + (2 * parameters.padding),
                    h: s1[1] + (2 * parameters.padding)
                },
                n2 = _super.adapter.getNodeAt(1),
                s2 = _super.getSize(n2.id),
                p2 = _super.getPosition(n2.id),
                r2 = {
                    x: p2[0] - parameters.padding,
                    y: p2[1] - parameters.padding,
                    w: s2[0] + (2 * parameters.padding),
                    h: s2[1] + (2 * parameters.padding)
                },
                adj = Farahey.calculateSpacingAdjustment(r1, r2);


            var c1 = [ p1[0] + (s1[0] / 2), p1[1] + (s1[1] / 2)],
                c2 = [ p2[0] + adj.left + (s2[0] / 2), p2[1] + adj.top + +(s2[1] / 2)],
                d = Math.sqrt(Math.pow(c1[0] - c2[0], 2) + Math.pow(c1[1] - c2[1], 2));

            radius = (d / 2) / Math.sin(degreesPerNode / 2);
            for (i = 0; i < nodeCount; i++) {
                n = _super.adapter.getNodeAt(i);
                _super.setPosition(n.id, x + (Math.sin(curDegree) * radius), y + (Math.cos(curDegree) * radius), true);
                curDegree += degreesPerNode;
            }

            _super.setDone(true);
        };
    };
}).call(this);

/**
 * Provides a hierarchical tree layout, oriented either horizontally or vertically.
 * @class Layouts.Hierarchical
 * @constructor
 * @param {Object} params Constructor parameters
 * @param {String} [params.orientation="horizontal"] Orientation of the layout. Valid values are `"vertical"` and `"horizontal"`.
 * @param {Number[]} [params.padding] Array of padding values for x and y axes. Default is `[60, 60]`.
 * @param {Boolean} [compress = false] If true, the layout will use a regular spacing between each node and its parent. Otherwise
 * the layout pushes each node down by the maximum size of some element in that level of the hierarchy. For complex
 * hierarchies in which any given node may have children, that is better. But for simple hierarchies, setting
 * `compress` can give good results.
 */
;
(function () {

    "use strict";

    var root = this;
    var JTK = root.jsPlumbToolkit;
    var exports = JTK.Layouts;

    exports.Hierarchical = function (params) {
        var _super = exports.AbstractHierarchicalLayout.apply(this, arguments),
            orientation, _horizontal, axisIndex, axisDimension, nodeCount, padding,
            maxSizes = [],
            _visitedNodes,
            compress = params.parameters != null ? params.parameters.compress : false,
            _hierarchy = [], _childGroups = [],
            _id = _super.toolkit.getNodeId,
            _getChildEdges,
            _get = function (depth) {
                var h = _hierarchy[depth];
                if (!h) {
                    h = { nodes: [], pointer: 0 };
                    _hierarchy[depth] = h;
                }
                return h;
            },
            _add = function (node, nodeSize, depth, parent, childGroup) {
                // get the info for this level; info contains a list of nodes and a current pointer for position
                // of the next inserted node. this pointer is incremented by the size of each new node plus padding.
                // note that we have derived 'axisIndex' above to tell us whether to use width or height, depending on the
                // layout's orientation.
                var h = _get(depth),
                // make an entry for this node.
                    i = {
                        node: node,
                        parent: parent,
                        childGroup: childGroup,
                        loc: h.pointer,
                        index: h.nodes.length,
                        dimensions: nodeSize,
                        size: nodeSize[axisIndex]
                    };
                var otherAxis = nodeSize[axisIndex == 0 ? 1 : 0];

                if (maxSizes[depth] == null)
                    maxSizes[depth] = otherAxis;
                else
                    maxSizes[depth] = Math.max(maxSizes[depth], otherAxis);

                // increment the pointer by the size of the node plus padding.
                h.pointer += (nodeSize[axisIndex] + padding[axisIndex]);
                // add the new node.
                h.nodes.push(i);
                return i;
            },
        // register a child group at a given depth.
            _addChildGroup = function (cg, depth) {
                var level = _childGroups[depth];
                if (!level) {
                    level = [];
                    _childGroups[depth] = level;
                }
                cg.index = level.length;
                level.push(cg);
            },
            _centerChildGroup = function (cg) {
                if (cg.size > 0) {
                    var idealLoc = (cg.parent.loc + (cg.parent.size / 2)) - ((cg.size - padding[axisIndex]) / 2); // remove last padding from child group in size calc
                    // get the existing groups for this groups level and find the furthest pointer.
                    var groups = _childGroups[cg.depth],
                        lastPointer = -Infinity,
                        delta = 0;

                    if (groups != null && groups.length > 0) {
                        var lg = groups[groups.length - 1],
                            lgn = lg.nodes[lg.nodes.length - 1];
                        lastPointer = lgn.loc + lgn.size + padding[axisIndex];
                    }

                    if (idealLoc >= lastPointer) {
                        cg.loc = idealLoc;
                    }
                    else {
                        delta = lastPointer - idealLoc;
                        cg.loc = lastPointer;
                    }

                    // place the nodes in the child group now.
                    // we may now have to re-center the parent for this group
                    var _l = cg.loc;
                    for (var i = 0; i < cg.nodes.length; i++) {
                        cg.nodes[i].loc = _l;
                        _l += cg.nodes[i].size;
                        _l += padding[axisIndex];
                    }

                    if (delta > 0) {
                        _centerParents(cg);
                    }

                    _addChildGroup(cg, cg.depth);
                }
            },
            _centerParent = function (cg) {
                var min = cg.nodes[0].loc,
                    max = cg.nodes[cg.nodes.length - 1].loc + cg.nodes[cg.nodes.length - 1].size,
                    c = (min + max) / 2,
                    pl = c - (cg.parent.size / 2),
                    pDelta = pl - cg.parent.loc;

                cg.parent.loc = pl;

                if (!cg.parent.root) {
                    // now, find the child group the parent belongs to, and its index in the child group, and adjust the
                    // rest of the nodes to the right of the parent in that child group.
                    var parentChildGroup = cg.parent.childGroup;
                    for (var i = cg.parent.childGroupIndex + 1; i < parentChildGroup.nodes.length; i++)
                        parentChildGroup.nodes[i].loc += pDelta;
                }
            },
            _centerParents = function (cg) {
                var _c = cg;
                while (_c != null) {
                    _centerParent(_c);
                    _c = _c.parent.childGroup;
                }
            },
            _doOne = function (info, level) {
                if (_visitedNodes[info.node.id]) return;
                _visitedNodes[info.node.id] = true;
                var edges = _getChildEdges(info.node, _super.toolkit),
                    childGroup = {
                        nodes: [], loc: 0, size: 0, parent: info, depth: level + 1
                    },
                    childInfoList = [], i;

                for (i = 0; i < edges.length; i++) {
                    // for each child node, get the node and its element object and dimensions
                    var childNode = edges[i].source === info.node ? edges[i].target: edges[i].source;
                    childNode = _super.toolkit.getNode(childNode);
                    if (childNode != null && childNode !== info.node) {
                        var s = _super.getSize(_id(childNode)),
                        // add the child node to the appropriate level in the hierarchy
                            childInfo = _add(childNode, s, level + 1, info, childGroup);
                        // and add it to this node's childGroup too.
                        childInfo.childGroupIndex = childGroup.nodes.length;
                        childGroup.nodes.push(childInfo);
                        // calculate how much room this child group takes
                        childGroup.size += (s[axisIndex] + padding[axisIndex]);
                        childInfoList.push(childInfo);
                    }
                }
                // now try to center this child group, with its computed size. this will place the individual node
                // entries, and adjust parents and their siblings as necessary.
                _centerChildGroup(childGroup);

                for (i = 0; i < childInfoList.length; i++) {
                    _doOne(childInfoList[i], level + 1);
                }
            };

        this.defaultParameters = {
            padding: [60, 60],
            orientation: "horizontal",
            border: 0,
            locationFunction:params.locationFunction
        };

        var sb = this.begin;
        this.begin = function (toolkit, parameters) {
            sb.apply(this, arguments);
            orientation = parameters.orientation;
            _horizontal = (orientation === "horizontal");
            axisIndex = _horizontal ? 0 : 1;
            axisDimension = _horizontal ? "width" : "height";
            nodeCount = _super.adapter.getNodeCount();
            padding = parameters.padding;
            _hierarchy.length = 0;
            _childGroups.length = 0;
            _visitedNodes = {};
            _getChildEdges = parameters.getChildEdges;
        };

        this.step = function (toolkit, parameters) {
            var rs = _super.getSize(parameters.root),
                info = _add(parameters.rootNode, rs, 0, null, null);

            info.root = true;
            // this will recurse down and place everything.
            _doOne(info, 0, null);
            // write positions.
            var otherAxis = 0, x, y, _otherAxis = function (n, oa) {
                var oai = axisIndex == 0 ? 1 : 0;
                return compress && n.parent ?
                    _super.getPosition(_id(n.parent.node))[oai] + n.parent.dimensions[oai] + padding[oai]
                    : oa;
            };
            for (var i = 0; i < _hierarchy.length; i++) {
                _hierarchy[i].otherAxis = otherAxis;
                for (var j = 0; j < _hierarchy[i].nodes.length; j++) {
                    x = axisIndex == 0 ? _hierarchy[i].nodes[j].loc : _otherAxis(_hierarchy[i].nodes[j], otherAxis);

                    if (_hierarchy[i].nodes[j].parent) {
                        _super.getPosition(_id(_hierarchy[i].nodes[j].parent.node));
                    }

                    y = axisIndex == 1 ? _hierarchy[i].nodes[j].loc : _otherAxis(_hierarchy[i].nodes[j], otherAxis);
                    // check to see if we will overlap the parent node?
                    _super.setPosition(_id(_hierarchy[i].nodes[j].node), x, y, true);
                }
                _hierarchy[i].otherAxisSize = (maxSizes[i] + padding[axisIndex == 0 ? 1 : 0]);
                otherAxis += _hierarchy[i].otherAxisSize;
            }

            _super.setDone(true);
        };

        /**
         * Gets the computed hierarchy. This is returned as an array of objects, one for each level, inside which
         * there is a `nodes` array.
         * @method getHierarchy
         * @returns {Array}
         */
        this.getHierarchy = function() { return _hierarchy; };

        /**
         * Gets the orientation of the layout - "horizontal" or "vertical".
         * @returns {String} "horizontal" or "vertical"
         */
        this.getOrientation = function() {
            return orientation;
        };

        //override nodeRemoved to clear hierarchy; it must be rebuilt
        var nr = this.nodeRemoved;
        this.nodeRemoved = function () {
            _hierarchy = [];
            nr.apply(this, arguments);
        };
    };

    jsPlumbUtil.extend(exports.Hierarchical, exports.AbstractHierarchicalLayout);

}).call(this);

/**
 * Provides a force directed graph layout in which connections between nodes are modelled as springs. By default, this Layout
 * switches on the magnetizer, to ensure that no nodes overlap.  You can switch it off via the `magnetize:false` argument
 * in the `layout` parameters of a `render` call.
 * @class jsPlumbToolkit.Layouts.Spring
 * @extends jsPlumbToolkit.Layouts.AbstractLayout
 * @constructor
 * @param {Object} params Constructor parameters
 * @param {Boolean} [params.absoluteBacked=true] Whether or not the layout will fall back to absolute positions stored in the data.
 * @param {Number} [params.stiffness=200] A measure of how stiff the springs are modelled to be.
 * @param {Number} [params.repulsion=200] A measure of how much each Node repels every other Node.
 * @param {Number} [params.damping=0.5] A measure of how quickly the system settles. This parameter should always be set to a value less than 1. A higher value for this parameter will cause the layout to take longer to run.
 * @param {Number} [params.limit=1000] The threshold below which the system is assumed to be stable enough for the layout to exit. This value is related to the values you provide for stiffness and repulsion (and damping, of course, but to a lesser extent).
 */
;
(function () {

    "use strict";

    var root = this;
    var JTK = root.jsPlumbToolkit;
    var exports = JTK.Layouts;

    exports.Spring = function (params) {
        this.defaultMagnetized = true;
        var _super = exports.AbsoluteBackedLayout.apply(this, arguments);

        this.defaultParameters = {
            padding: [50, 50],
            iterations: 500,
            maxRepulsiveForceDistance: 6,
            k: 2,
            c: 0.01,
            maxVertexMovement: 0.5,
            locationFunction:params.locationFunction
        };
        var currentParameters = this.defaultParameters;

        var _nodes = {},
            _absoluteBacked = params.absoluteBacked !== false,
            currentIteration = 0,
            minx = Infinity, maxx = -Infinity,
            miny = Infinity, maxy = -Infinity,
            xScale = 1, yScale = 1, nodeCount,
            _moveCount = 0,
            _get = function (node) {
                // get actual Node, if this was a Port.
                if (node.getNode) node = node.getNode();
                var n = _nodes[node.id];
                if (!n) {
                    var pos = _super.getRandomPosition(node.id, 0.5, 0.5);
                    n = _nodes[node.id] = {
                        id: node.id,
                        n: node,
                        // randomize current point.
                        sp: pos,
                        p: [ pos[0], pos[1] ],
                        f: [0, 0]
                    };
                }
                return n;
            },
            _pos = function (node, x, y) {
                minx = Math.min(minx, x);
                miny = Math.min(miny, y);
                maxx = Math.max(maxx, x);
                maxy = Math.max(maxy, y);
                node.p[0] = x;
                node.p[1] = y;
            },
            _repulsion = function (node1, node2) {
                // if both nodes locked, return.
                if (node1.locked && node2.locked) return;

                var dx = node2.p[0] - node1.p[0];
                var dy = node2.p[1] - node1.p[1];
                var d2 = dx * dx + dy * dy;
                if (d2 < 0.01) {
                    dx = 0.1 * Math.random() + 0.1;
                    dy = 0.1 * Math.random() + 0.1;
                    d2 = dx * dx + dy * dy;
                }

                var d = Math.sqrt(d2);
                if (d < currentParameters.maxRepulsiveForceDistance) {
                    _moveCount++;
                    var repulsiveForce = currentParameters.k * currentParameters.k / d,
                        xRepulsive = repulsiveForce * dx / d,
                        yRepulsive = repulsiveForce * dy / d;

                    node2.f[0] += node2.locked ? 0 : (node1.locked ? 2 : 1) * xRepulsive;
                    node2.f[1] += node2.locked ? 0 : (node1.locked ? 2 : 1) * yRepulsive;

                    node1.f[0] -= node1.locked ? 0 : (node2.locked ? 2 : 1) * xRepulsive;
                    node1.f[1] -= node1.locked ? 0 : (node2.locked ? 2 : 1) * yRepulsive;
                }
            },
            _attraction = function (node1, edge) {
                var node2 = _get(edge.target);

                if (node1.locked && node2.locked) return;

                _moveCount++;

                var dx = node2.p[0] - node1.p[0];
                var dy = node2.p[1] - node1.p[1];
                var d2 = dx * dx + dy * dy;
                if (d2 < 0.01) {
                    dx = 0.1 * Math.random() + 0.1;
                    dy = 0.1 * Math.random() + 0.1;
                    d2 = dx * dx + dy * dy;
                }
                var d = Math.sqrt(d2);
                if (d > currentParameters.maxRepulsiveForceDistance) {
                    d = currentParameters.maxRepulsiveForceDistance;
                    d2 = d * d;
                }
                var attractiveForce = (d2 - currentParameters.k * currentParameters.k) / currentParameters.k;
                if (edge.weight == undefined || edge.weight < 1) edge.weight = 1;
                attractiveForce *= Math.log(edge.weight) * 0.5 + 1;
                var afx = attractiveForce * dx / d,
                    afy = attractiveForce * dy / d;

                node2.f[0] -= node2.locked ? 0 : (node1.locked ? 2 : 1) * afx;
                node2.f[1] -= node2.locked ? 0 : (node1.locked ? 2 : 1) * afy;
                node1.f[0] += node1.locked ? 0 : (node2.locked ? 2 : 1) * afx;
                node1.f[1] += node1.locked ? 0 : (node2.locked ? 2 : 1) * afy;

            },
            _translation = function () {
                xScale = _super.width / (maxx - minx) * 0.62;
                yScale = _super.height / (maxy - miny) * 0.62;

                for (var nid in _nodes) {
                    var _n = _nodes[nid];
                    if (!_n.locked) {
                        _n.sp = _toScreen(_n.p);
                        _super.setPosition(_n.id, _n.sp[0], _n.sp[1], true);
                    }
                }
            },
            _fromScreen = function (xy) {
                return [
                        minx + (xy[0] - (0.19 * _super.width)) / xScale,
                        miny + (xy[1] - (0.19 * _super.height)) / yScale,
                ];
            },
            _toScreen = function (xy) {
                return [
                        (0.19 * _super.width) + ((xy[0] - minx) * xScale),
                        (0.19 * _super.height) +  ((xy[1] - miny) * yScale)
                ];
            };

        this._nodeMoved = function (id, x, y) {
            var n = _nodes[id];
            if (n) {
                n.sp = [x, y];
                n.p = _fromScreen(n.sp);
            }
        };

        this.canMagnetize = function(id) {
            return _nodes[id] && _nodes[id].locked !== true;
        };

        // provide this for the superclass to call.
        this.reset = function () {
            _nodes = {};
            currentIteration = 0;
            minx = miny = Infinity;
            maxx = maxy = -Infinity;
        };

        this._nodeRemoved = function (nodeId) {
            delete _nodes[nodeId];
        };

        // implement this optional method so that if a Node is added that has eventInfo with a position, we know that we
        // should lock its location and not move it when the layout refreshes.
        this._nodeAdded = function (params, eventInfo) {
            if (eventInfo && eventInfo.position) {
                var n = _get(params.node);
                if (n) {
                    n.locked = true;
                    _super.setPosition(n.id, eventInfo.position.left, eventInfo.position.top, true);
                }
            }
        };

        this.begin = function (toolkit, parameters) {
            currentIteration = 0;
            nodeCount = _super.adapter.getNodeCount();
        };

        this.step = function (toolkit, parameters) {
            var i, _cache = [], __get = function (idx) {
                return _cache[idx] ? _cache[idx] : (function () {
                    _cache[idx] = _get(_super.adapter.getNodeAt(idx));
                    return _cache[idx];
                })();
            };

            // a small perf enhancement: if no repulsion or attraction occurred in this iteration, everything is
            // locked, and we can finish
            _moveCount = 0;
            // Forces on nodes due to node-node repulsions
            for (i = 0; i < nodeCount; i++) {
                var node1 = __get(i);

                if (_absoluteBacked && !node1.locked) {
                    var ap = this.getAbsolutePosition(node1.n, parameters);
                    if (ap != null && ap.length == 2 && !isNaN(ap[0]) && !isNaN(ap[1])) {
                        _pos(node1, ap[0], ap[1]);
                        node1.sp = node1.p;
                        _super.setPosition(node1.id, ap[0], ap[1], true);
                        node1.locked = true;
                        continue;
                    }
                }

                for (var j = i + 1; j < nodeCount; j++) {
                    var node2 = __get(j);
                    _repulsion(node1, node2);
                }
                var edges = _super.toolkit.getAllEdgesFor(node1.n);
                for (var k = 0; k < edges.length; k++) {
                    _attraction(node1, edges[k]);
                }
            }

            if (_moveCount != 0) {
                // Move by the given force
                for (i = 0; i < nodeCount; i++) {
                    var node = __get(i);
                    var xmove = currentParameters.c * node.f[0];
                    var ymove = currentParameters.c * node.f[1];

                    var max = currentParameters.maxVertexMovement;
                    if (xmove > max) xmove = max;
                    if (xmove < -max) xmove = -max;
                    if (ymove > max) ymove = max;
                    if (ymove < -max) ymove = -max;

                    _pos(node, node.p[0] + xmove, node.p[1] + ymove);
                    node.f[0] = 0;
                    node.f[1] = 0;
                }
            }

            currentIteration++;

            if (_moveCount == 0 || currentIteration >= currentParameters.iterations) {
                _translation();
                _super.setDone(true);
            }
        };

        this.end = function() {
            for (var nid in _nodes)
                _nodes[nid].locked = true;
        };
    };

    jsPlumbUtil.extend(exports.Spring, exports.AbsoluteBackedLayout);

}).call(this);

/*
 * Components
 *
 * Copyright 2015 jsPlumb
 * http://jsplumbtoolkit.com
 *
 * This software is not free.
 *
 * This file contains the various UI components offered by the jsPlumb Toolkit.
 *
 * Namespace: jsPlumbToolkit.Renderers
 *
 * Dependencies:
 *
 * jsPlumbToolkit
 * jsPlumbToolkitUtil
 * jsPlumbUtil
 *
 */
;
(function () {

    "use strict";

    var root = this;
    var exports = root.jsPlumbToolkit.Renderers;
    var JTK = root.jsPlumbToolkit;
    var UTIL = root.jsPlumbToolkitUtil;
    var JUTIL = root.jsPlumbUtil;
    //var ADAPTER = root.jsPlumbAdapter;

    JTK.UIState = function (id, state, _jsPlumb) {
        for (var type in state) {
            if (state.hasOwnProperty(type)) {
                var pState = type === "*" ? "e-state-" + id : "e-state-" + id + "-" + type;
                var eState = type === "*" ? "c-state-" + id : "c-state-" + id + "-" + type;
                _jsPlumb.registerEndpointType(pState, state[type]);
                _jsPlumb.registerConnectionType(eState, state[type]);
            }
        }

        this.activate = function (target, renderer, toolkit) {

            target.eachEdge(function (i, e) {
                var conn = renderer.getRenderedConnection(e.getId()),
                    t = toolkit.getEdgeType(e.data),
                    s = t ? "c-state-" + id + "-" + t : null;

                if (s) {
                    conn.addType(s);
                }

                // wildcard
                if (state["*"])
                    conn.addType("c-state-" + id);

                _portStateOperation(e, conn, e.source, 0, "addType", toolkit);
                _portStateOperation(e, conn, e.target, 1, "addType", toolkit);
            });

            // nodes just offer add/remove class
            target.eachNode(function (i, n) {
                var t = toolkit.getNodeType(n.data), s = t ? state[t] : null,
                    rn = renderer.getRenderedNode(n.id);

                if (s && s.cssClass)
                    _jsPlumb.addClass(rn, s.cssClass);

                if (state["*"])
                    _jsPlumb.addClass(rn, state["*"].cssClass);
            });
        };

        var _portStateOperation = function (edge, conn, obj, idx, op, toolkit) {
            var ep = conn.endpoints[idx],
                t = toolkit.getPortType(obj.data);

            ep[op]("e-state-" + id + "-" + t);
            ep[op]("e-state-" + id);
        };

        this.deactivate = function (target, renderer, toolkit) {

            target.eachEdge(function (i, e) {
                var conn = renderer.getRenderedConnection(e.getId()),
                    t = toolkit.getEdgeType(e.data),
                    s = t ? "c-state-" + id + "-" + t : null;

                if (s)
                    conn.removeType(s);

                // wildcard
                if (state["*"])
                    conn.removeType("c-state-" + id);

                _portStateOperation(e, conn, e.source, 0, "removeType", toolkit);
                _portStateOperation(e, conn, e.target, 1, "removeType", toolkit);
            });

            target.eachNode(function (i, n) {
                var t = toolkit.getNodeType(n.data), s = t ? state[t] : null,
                    rn = renderer.getRenderedNode(n.id);

                if (s && s.cssClass)
                    _jsPlumb.removeClass(rn, s.cssClass);

                if (state["*"])
                    _jsPlumb.removeClass(rn, state["*"].cssClass);
            });
        };
    };

    var atts = exports.atts = { NODE: "data-jtk-node-id", PORT: "data-jtk-port-id" },
        els = exports.els = { SOURCE: "JTK-SOURCE", PORT: "JTK-PORT", TARGET: "JTK-TARGET" },
        _cl = jsPlumbToolkit.Classes,
        _c = jsPlumbToolkit.Constants,
        _e = jsPlumbToolkit.Events;

    exports.mouseEvents = [ "click", "dblclick", "contextmenu", "mousedown", "mouseup", "mousemove", "mouseenter", "mouseleave", "mouseover" ];
    exports.createElement = function (params, parent) {
        var d = document.createElement(params.type || _c.div),
            units = params.units || _c.px;

        if (params.top != null) d.style.top = params.top + _c.px;
        if (params.left != null) d.style.left = params.left + _c.px;
        if (params.right != null) d.style.right = params.right + _c.px;
        if (params.bottom != null) d.style.bottom = params.bottom + _c.px;
        d.style.width = params.width;
        d.style.height = params.height;
        d.style.position = params.position || _c.absolute;
        if (params.id) d.setAttribute(_c.id, params.id);
        if (params.display) d.style.display = params.display;
        if (params.clazz) d.className = params.clazz;
        if (parent != null) {
            jsPlumb.appendElement(d, parent);
        }
        return d;
    };

// **************** rendering ************

    /*
     Function: _defaultNodeRenderFunction
     This is the default that the jsPlumb toolkit will use if you do not supply either a render function or a template id.
     It draws a div with a basic 1px solid border.
     */
    var _defaultNodeRenderFunction = function (data, id) {
            var d = document.createElement("div");
            d.innerHTML = data.name || data.id;
            d.className = _cl.NODE;
            d.style.border = "1px solid #456";
            d.style.position = "absolute";
            return d;
        },
        _defaultTemplate = "<div data-jtk-node-id=\"${id}\" class=\"" + _cl.NODE + "\"></div>",
        _defaultTemplateRenderers = {
            "rotors": {
                render: function (templateId, data) {
                    return _rotors.template(templateId, data).childNodes[0];
                }
            }
        },
        _defaultTemplateRendererName = "rotors";

    var _rotors = Rotors.newInstance({ defaultTemplate:_defaultTemplate });

// *********** adapters for positioning - layouts call adapters and dont work directly with offsets. ***************************

    /**
     Adapter for a normal DOM element
     */
    var DOMElementAdapter = exports.DOMElementAdapter = function (params) {
        var _jsPlumb = this.getJsPlumb(),
            _el = _jsPlumb.getElement(params.container);

        this.getWidth = function () {
            return _jsPlumb.getSize(_el)[0];
        };

        this.getHeight = function () {
            return _jsPlumb.getSize(_el)[1];
        };

        this.append = function (e) {
            var _e = _jsPlumb.getElement(e);
            _jsPlumb.appendElement(_e, _el);
        };

        this.remove = function (e) {
            var _e = _jsPlumb.getElement(e);
            _jsPlumb.removeElement(_e);
        };

        this.setAbsolutePosition = jsPlumb.setAbsolutePosition;

        this.getOffset = function (e, relativeToPage) {
            return _jsPlumb.getOffset(e, relativeToPage);
        };
    };

    /**
     * Superclass for renderers
     * @class jsPlumbToolkit.Renderers.AbstractRenderer
     * @constructor
     * @param {Object} params Constructor parameters.
     * @param {Object} [params.view] Parameters for Node, Port and Edge definitions. Although this is not a required parameter, the vast majority of applications will
     * @param {Boolean} [params.elementsDraggable=true] Whether or not elements should be made draggable.
     * @param {Boolean} [params.elementsDroppable=false] If true, elements can be dragged onto other elements and events will be fired.
     * What you choose to do with that event is up to you.
     * @param {String} [params.id] Optional id for this renderer. If you provide this you can then subsequently retrieve it via `toolkit.getRenderer(<id>)`.
     * @param {Boolean} [params.refreshAutomatically=true] Whether or not to automatically refresh the associated layout whenever a Node is added or deleted.
     * @param {Boolean} [params.enhancedView=true] If false, there will be no support for preconfigured parameters or functions in the definitions inside a view. You will want to set this for Angular if you use the 2-way data binding.
     * @param {Function} [params.assignPosse] optional function that, given each node, can return the id of the posse to which the node belongs. a Posse is a group of nodes that should all be dragged together.
     * @param {String} [params.modelLeftAttribute="left"] Optional; specifies the name of the attribute by which to store the x position of a dragged node of `storePositionsInModel` is true.
     * @param {String} [params.modelTopAttribute="top"] Optional; specifies the name of the attribute by which to store the y position of a dragged node of `storePositionsInModel` is true.
     */
    var AbstractRenderer = exports.AbstractRenderer = function (params) {
        params = params || {};
        var self = this,
            _toolkit = params.toolkit,
            _layout = new JTK.Layouts.EmptyLayout(self),
            containerElement = jsPlumb.getElement(params.container),
            draggable = !(params.elementsDraggable === false),
            droppable = params.elementsDroppable === true,
            _suspendRendering = false,
            _refreshAutomatically = params.refreshAutomatically !== false,
            _idFunction = params.idFunction || _toolkit.getNodeId,
            _typeFunction = params.typeFunction || _toolkit.getNodeType,
            _edgeIdFunction = params.edgeIdFunction || _toolkit.getEdgeId,
            _edgeTypeFunction = params.edgeTypeFunction || _toolkit.getEdgeType,
            _portIdFunction = params.portIdFunction || _toolkit.getPortId,
            _portTypeFunction = params.portTypeFunction || _toolkit.getPortType,
            _thisTemplateRenderer = params.templateRenderer ? JUTIL.isString(params.templateRenderer) ? _defaultTemplateRenderers[params.templateRenderer] : { render: params.templateRenderer } : _defaultTemplateRenderers[_defaultTemplateRendererName],
            enhancedView = params.enhancedView !== false,
            posseAssigner = params.assignPosse || function() { return null;},
            _modelLeftAttribute = params.modelLeftAttribute || "left",
            _modelTopAttribute = params.modelTopAttribute || "top";

        var jsPlumbParams = JUTIL.merge(params.jsPlumb || {}),
            _jsPlumb = params.jsPlumbInstance || jsPlumb.getInstance(jsPlumbParams),
            containerId = _jsPlumb.getId(containerElement);

        // wire up a beforeDrop interceptor for the jsplumb instance to the Toolkit's beforeConnect method
        _jsPlumb.bind("beforeDrop", function(params) {
            var c = params.connection,
                sourceJtk = c.endpoints[0].graph || c.source.jtk,
                targetJtk = c.endpoints[1].graph || c.target.jtk,
                s = sourceJtk.port || sourceJtk.node,
                t = targetJtk.port || targetJtk.node,
                e = params.connection.edge;

            if (e == null)
                return _toolkit.beforeConnect(s, t, params.connection.getData());
            else
                return _toolkit.beforeMoveConnection(s, t, e);
        });
        // might have to add this to jsplumb? not very appealing. perhaps just do this code inside the add port stuff.
        //_jsPlumb.bind("canDrop", _toolkit.canDrop);

        _jsPlumb.bind("beforeDrag", function(params) {
            var jtkSource = params.endpoint.graph || params.source.jtk,
                e = jtkSource.port || jtkSource.node,
                cType = params.endpoint.connectionType;

            return _toolkit.beforeStartConnect(e, cType);
        });

        _jsPlumb.bind("beforeDetach", function(connection, isDiscard) {
            var sourceJtk = connection.endpoints[0].graph || connection.source.jtk,
                targetJtk = connection.endpoints[1].graph || connection.target.jtk,
                s = sourceJtk.port || sourceJtk.node,
                t = targetJtk.port || targetJtk.node,
                e = connection.edge;

            return _toolkit.beforeDetach(s, t, e, isDiscard);
        });

        _jsPlumb.bind("beforeStartDetach", function(params) {
            var jtkSource = params.endpoint.graph || params.source.jtk,
                s = jtkSource.port || jtkSource.node,
                e = params.connection.edge;

            return _toolkit.beforeStartDetach(s, e);
        });

        JUTIL.EventGenerator.apply(this, arguments);

        // expose jsplumb mostly for testing
        this.getJsPlumb = function () {
            return _jsPlumb;
        };
        this.getToolkit = function () {
            return _toolkit;
        };
        // renderer has some events, but also exposes jsplumb events
        var localEvents = [ _e.canvasClick, _e.canvasDblClick, _e.nodeAdded, _e.nodeDropped,
                _e.nodeRemoved, _e.nodeRendered,
                _e.nodeMoveStart, _e.nodeMoveEnd, _e.portAdded,
                _e.portRemoved, _e.edgeAdded, _e.edgeRemoved,
                _e.dataLoadEnd, _e.anchorChanged, _e.objectRepainted,
                _e.modeChanged,
                _e.pan, _e.zoom, _e.relayout, _e.click, _e.tap, _e.stateRestored, _e.startOverlayAnimation, _e.endOverlayAnimation ],
            _bind = self.bind,
            _jbind = _jsPlumb.bind;

        /**
         * Sets/unsets hover suspended state. When hover is suspended, no connections or endpoints repaint themselves
         * on mouse hover.
         * @method setHoverSuspended
         * @param {Boolean} suspended
         */
        this.setHoverSuspended = _jsPlumb.setHoverSuspended;

        /**
         * Gets hover suspended state.
         * @method isHoverSuspended
         * @return {Boolean} Hover suspended state.
         */
        this.isHoverSuspended = _jsPlumb.isHoverSuspended;

        /**
         * Sets the current jsPlumb defaults
         * @method setJsPlumbDefaults
         * @param {Object} defaults Defaults to set.
         */
        this.setJsPlumbDefaults = function (defaults) {
            // cannot set Container this way
            delete defaults.Container;
            _jsPlumb.restoreDefaults();
            _jsPlumb.importDefaults(defaults);
        };

        this.bind = function (evt, fn) {
            if (localEvents.indexOf(evt) == -1)
                _jbind(evt, fn);
            else
                _bind(evt, fn);
        };

        // *************** events ********************************
        if (params.events) {
            for (var evt in params.events) {
                this.bind(evt, params.events[evt]);
            }
        }
        // *************** /events ********************************

        // *************** interceptors ********************************
        if (params.interceptors) {
            for (var int in params.interceptors) {
                this.bind(int, params.interceptors[int]);
            }
        }
        // *************** /events ********************************

        var _ignoreToolkitEvents = false;
        _jbind(_e.connection, function (info) {
            if (info.connection.edge != null) return;
            _ignoreToolkitEvents = true;

            // if nodeId is not set on source endpoint, set it, by doing a lookup from reverseNodeMap
            if (!info.sourceEndpoint.getParameter("nodeId"))
                info.sourceEndpoint.setParameter("nodeId", reverseNodeMap[info.sourceEndpoint.elementId].id);

            if (!info.targetEndpoint.getParameter("nodeId"))
                info.targetEndpoint.setParameter("nodeId", reverseNodeMap[info.targetEndpoint.elementId].id);

            var sourcePortTypeId = info.sourceEndpoint.getParameter("portType"),
                sourcePortType = view.getPortDefinition(sourcePortTypeId),
                edgeType = sourcePortType != null && sourcePortType.edgeType ? sourcePortType.edgeType : "default",
                sourceNodeId = info.sourceEndpoint.getParameter("nodeId"),
                sourcePortId = info.sourceEndpoint.getParameter("portId"),
                targetNodeId = info.targetEndpoint.getParameter("nodeId"),
                targetPortId = info.targetEndpoint.getParameter("portId"),
                sourceId = sourceNodeId + (sourcePortId ? "." + sourcePortId : ""),
                targetId = targetNodeId + (targetPortId ? "." + targetPortId : ""),
                params = {
                    sourceNodeId: sourceNodeId,
                    sourcePortId: sourcePortId,
                    targetNodeId: targetNodeId,
                    targetPortId: targetPortId,
                    type: edgeType,
                    source: _toolkit.getNode(sourceId),
                    target: _toolkit.getNode(targetId),
                    sourceId: sourceId,
                    targetId: targetId
                };

            var doAbort = _toolkit.getEdgeFactory()(edgeType, info.connection.getData() || {}, function (data) {
                params.edge = _toolkit.addEdge({
                    source: sourceId,
                    target: targetId,
                    cost: info.connection.getCost(),
                    directed: info.connection.isDirected(),
                    data: data,
                    addedByMouse: true
                }, self);
                connMap[params.edge.getId()] = info.connection;
                info.connection.edge = params.edge;
                _maybeAttachEdgeEvents(edgeType, params.edge, info.connection);
                params.addedByMouse = true;
                self.fire(_e.edgeAdded, params);
            });
            // if edge factory explicitly returned false, delete the connection.
            if (doAbort === false) {
                _jsPlumb.detach(info.connection);
            }
            _ignoreToolkitEvents = false;
        });

        // fired when the user moves a connection with the mouse. we advise the toolkit and it takes action.
        _jbind(_e.connectionMoved, function(info) {
            var o = info.index == 0 ? info.newSourceEndpoint : info.newTargetEndpoint;
            _toolkit.edgeMoved(info.connection.edge, (o.element.jtk.port || o.element.jtk.node), info.index);
        });

        // fired only when an edge was removed via the UI.
        _jbind(_e.connectionDetached, function (info) {
            _ignoreToolkitEvents = true;
            _toolkit.removeEdge(info.connection.edge);
            _ignoreToolkitEvents = false;
            var sp = info.sourceEndpoint.getParameters(), tp = info.targetEndpoint.getParameters(),
                sourceId = sp.nodeId + (sp.portId ? "." + sp.portId : ""),
                targetId = tp.nodeId + (tp.portId ? "." + tp.portId : "");
            self.fire(_e.edgeRemoved, {
                sourceNodeId: sp.nodeId,
                targetNodeId: tp.nodeId,
                sourcePortId: sp.portId,
                targetPortId: tp.portId,
                sourceId: sourceId,
                targetId: targetId,
                source: _toolkit.getNode(sourceId),
                target: _toolkit.getNode(targetId),
                edge: info.connection.edge
            });
        });

// ---------- bind to events in the toolkit ---------------------
        var nodeMap = {}, reverseNodeMap = {}, portMap = {};
        var nodeList = [], _addNodeToList = function(n) {
                nodeList.push(n);
            },
            _removeNodeFromList = function(n) {
                var idx = nodeList.indexOf(n);
                if (idx != -1) nodeList.splice(idx, 1);
            };

        this.getNodeCount = function() {
            return nodeList.length;
        };
        this.getNodeAt = function(idx) {
            return nodeList[idx];
        };
        this.getNodes = function() { return nodeList; };
        this.getNode = function(id) { return nodeMap[id]; };

        var connMap = {},
            _getConnectionForEdge = function (edge) {
                return connMap[edge.getId()];
            },
            _getConnectionsForEdges = function (edges) {
                var c = [];
                for (var i = 0; i < edges.length; i++)
                    c.push(connMap[edges[i].getId()]);
                return c;
            },
            _bindAConnectionEvent = function (id, listener, edge, connection) {
                connection.bind(id, function (e, originalEvent) {
                    listener.apply(listener, [
                        {
                            edge: edge,
                            e: originalEvent,
                            connection: connection,
                            toolkit: _toolkit,
                            renderer: self
                        }
                    ]);
                });
            },
            _maybeAttachEdgeEvents = function (type, edge, connection) {
                // if this connection already has an associated edge, do nothing.
                if (connection.getParameter("edge")) return;
                var edgeTypeDefinition = view.getEdgeDefinition(type);
                // set events too, if they were provided in the edge definition
                if (edgeTypeDefinition && edgeTypeDefinition.events) {
                    for (var i in edgeTypeDefinition.events) {
                        _bindAConnectionEvent(i, edgeTypeDefinition.events[i], edge, connection);
                    }
                }
            };
        var _fireEdgeRemoved = function (c, edge) {
            var sp = c.endpoints[0].getParameters(), tp = c.endpoints[1].getParameters(),
                sourceId = sp.nodeId + (sp.portId ? "." + sp.portId : ""),
                targetId = tp.nodeId + (tp.portId ? "." + tp.portId : "");

            self.fire(_e.edgeRemoved, {
                sourceNodeId: sp.nodeId,
                targetNodeId: tp.nodeId,
                sourcePortId: sp.portId,
                targetPortId: tp.portId,
                sourceId: sourceId,
                targetId: targetId,
                source: _toolkit.getNode(sourceId),
                target: _toolkit.getNode(targetId),
                edge: edge
            });
        };

        /**
         * Sets whether or not rendering is suspended. This actually does not mean that new nodes are not
         * added, but it does mean that the panzoom widget is informed not to do any work involving element
         * postions or sizes.
         * @param val
         */
        this.setSuspendRendering = function (val, thenRefresh) {
            _suspendRendering = val;
            _jsPlumb.setSuspendDrawing(val);
            if (thenRefresh) {
                this.refresh();
            }
        };

        if (this.bindToolkitEvents !== false) {
            var _startFn = function () {
                _jsPlumb.setSuspendDrawing(true);
                this.setSuspendRendering(true);
            }.bind(this);

            _toolkit.bind(_e.dataLoadStart, _startFn);
            _toolkit.bind(_e.dataAppendStart, _startFn);
            _toolkit.bind(_e.dataLoadEnd, function () {
                this.setSuspendRendering(false);
                self.relayout();
                _jsPlumb.setSuspendDrawing(false, true);
                if (_layout) self.fire(_e.dataLoadEnd);
            }.bind(this));
            _toolkit.bind(_e.dataAppendEnd, function () {
                this.setSuspendRendering(false);
                self.refresh();
                _jsPlumb.setSuspendDrawing(false, true);
                if (_layout) self.fire(_e.dataAppendEnd);
            }.bind(this));

            //
            // does the work of rendering a node, stashing it,
            // and checking it for rendered ports.
            var _doRenderNode = function(n, eventInfo) {
                // does a DOM element for this node already exist?
                var nodeEl = nodeMap[n.id];
                if (nodeEl == null) {

                    // check node definition to see if we should ignore it.
                    var nd = view.getNodeDefinition(_typeFunction(n.data));
                    if (nd.ignore === true) return false;
                    // return FALSE if so.

                    nodeEl = nodeRenderer(n, n.data, n);
                    if (!nodeEl) throw new Error("Cannot render node");
                    var elId = _jsPlumb.getId(nodeEl);
                    nodeMap[n.id] = nodeEl;
                    reverseNodeMap[elId] = n;
                    _addNodeToList(n);
                    nodeEl.jtk = { node: n };
                    self.append(nodeEl, elId, eventInfo ? eventInfo.position : null);

                    var posse = posseAssigner(n);
                    if (posse != null) {
                        // posse assign function can return just a string, giving the name of a posse in which the
                        // element acts as a drag master, or an object (in which you can indicate an element is in
                        //  posse but is passive), or an array of these.
                        var args = jsPlumbUtil.isArray(posse) ? posse : [ posse ];
                        args.unshift(nodeEl);
                        _jsPlumb.addToPosse.apply(_jsPlumb, args);
                    }

                    _checkForPorts(nodeEl, n, n.id);
                    var np = {node: n, el: nodeEl};
                    self.getLayout().nodeAdded(np, eventInfo);
                    self.fire(_e.nodeAdded, np);
                }
                return nodeEl;
            };

            //
            // Notification a new Node was added - this function renders it, and then calls refresh on the layout if there is
            // one.
            //
            _toolkit.bind(_e.nodeAdded, function (params) {
                var n = params.node, i;
                var nodeEl = _doRenderNode(n, params.eventInfo);
                if (nodeEl != null) {
                    var ports = _jsPlumb.getSelector(nodeEl, "[data-port-id]");
                    for (i = 0; i < ports.length; i++) {
                        var portId = ports[i].getAttribute("data-port-id");
                        portMap[n.id + "." + portId] = ports[i];
                        ports[i].jtk = ports[i].jtk || { node: n, port: n.getPort(portId) }; // port may still be null here; that's ok.
                    }

                    self.refresh(true);
                }

            });

            //
            // Notification a Node was removed - this function removes all UI components, and then calls refresh on the layout if there is
            // one.
            //
            _toolkit.bind(_e.nodeRemoved, function (params) {
                // update the layout
                self.getLayout().nodeRemoved(params.nodeId);
                self.fire(_e.nodeRemoved, { node: params.nodeId, el: nodeMap[params.nodeId] });
                var elId = _jsPlumb.getId(nodeMap[params.nodeId]);
                _jsPlumb.remove(nodeMap[params.nodeId]);
                delete nodeMap[params.nodeId];
                delete reverseNodeMap[elId];
                _removeNodeFromList(params.node);
                self.refresh(true);
            });

            var directEdgeConnector = function (edge) {
                return function () {
                    var connectionParams = _prepareConnectionParams(edge);
                    connectionParams.doNotFireConnectionEvent = true;
                    if (_toolkit.isDebugEnabled()) console.log("Renderer", "adding edge with params", connectionParams);
                    var conn = _jsPlumb.connect(connectionParams);
                    conn.edge = edge;
                    connMap[edge.getId()] = conn;
                    _maybeAttachEdgeEvents(connectionParams.type, edge, conn);
                    self.fire(_e.edgeAdded, {
                        source: edge.source,
                        target: edge.target,
                        connection: conn,
                        edge: edge
                    });
                    self.refresh(true);
                };
            };

            //
            // Notification that an Edge was added. We want to create an appropriate connection in the jsPlumb
            // instance we are managing. Note 'connMap' above; we use that to map edges to actual connections.
            //
            _toolkit.bind(_e.edgeAdded, function (data) {
                if (!_ignoreToolkitEvents && data.source !== self) {
                    var edge = data.edge;
                    var def = view.getEdgeDefinition(_edgeTypeFunction(edge.data || {}));
                    if (def && def.ignore === true) return;
                    // create a function that will establish the jsplumb connection.  If we've been given a connectionHandler
                    // then we pass the function to it, along with the related edge, expecting that at some point the
                    // handler will execute the connect function (this is used, for instance, in Angular integration, in which
                    // template loading and painting is asynchronous
                    var connectFunction = directEdgeConnector(edge);
                    if (params.connectionHandler)
                        params.connectionHandler(edge, connectFunction);
                    else
                    // otherwise we just execute the connect function directly.
                        connectFunction();
                }
            });

            //
            // Notification that an edge was removed. We want to remove the corresponding connection from our jsPlumb instance.
            //
            _toolkit.bind(_e.edgeRemoved, function (data) {
                if (!_ignoreToolkitEvents && data.source !== self) {
                    var edge = data.edge;
                    var connection = connMap[edge.getId()];
                    if (connection) {
                        if (_toolkit.isDebugEnabled()) console.log("Renderer", "removing edge", edge);
                        _fireEdgeRemoved(connection, edge);
                        _jsPlumb.detach({connection: connMap[edge.getId()], fireEvent: false});
                        delete connMap[edge.getId()];
                    }
                }
            });

            // Notification that the target of an edge was changed
            _toolkit.bind(_e.edgeTarget, function (data) {
                if (!_ignoreToolkitEvents) {
                    var edge = data.edge;
                    var connection = connMap[edge.getId()];
                    var n = nodeMap[edge.target.getFullId()];
                    if (connection) {

                        if (n != null) {
                            if (_toolkit.isDebugEnabled()) console.log("target change", connection);
                            _jsPlumb.setTarget(connection, n);
                        }
                        else {
                            delete connMap[edge.getId()];
                            _jsPlumb.detach({
                                connection:connection,
                                forceDetach:true,
                                fireEvent:false
                            });
                        }
                    }
                    else {
                        if (n != null) {
                            if (_toolkit.isDebugEnabled()) {
                                jsPlumbUtil.log("Target for Edge " + edge.getId() + " changed to Node " + n.id + "; we have no valid connection.");
                            }
                        }

                    }
                }
            });

            // Notification that the source of an edge was changed
            _toolkit.bind(_e.edgeSource, function (data) {
                if (!_ignoreToolkitEvents) {
                    var edge = data.edge;
                    var connection = connMap[edge.getId()];
                    var n = nodeMap[edge.source.getFullId()];
                    if (connection) {
                        if (n != null) {
                            _jsPlumb.setSource(connection, n);
                        }
                        else {
                            delete connMap[edge.getId()];
                            _jsPlumb.detach({
                                connection:connection,
                                forceDetach:true,
                                fireEvent:false
                            });
                        }
                    }
                    else {
                        if (n != null) {
                            if (_toolkit.isDebugEnabled()) {
                                jsPlumbUtil.log("Source for Edge " + edge.getId() + " changed to Node " + n.id + "; we have no valid connection.");
                            }
                        }
                    }
                }
            });

            //
            // Notification that the graph was cleared. We remove everything from our jsPlumb instance (but do not
            // unbind any event listeners).
            //
            _toolkit.bind("graphCleared", function () {
                // clear nodes
                for (var n in nodeMap) {
                    _jsPlumb.remove(nodeMap[n], true);
                }
                _layout && _layout.clear();

                // suspend events, then suspend drawing, then delete every endpoint.
                _jsPlumb.setSuspendEvents(true);
                _jsPlumb.batch(_jsPlumb.deleteEveryEndpoint, true);
                _jsPlumb.setSuspendEvents(false);

                nodeList.length = 0;
                connMap = {};
                nodeMap = {};
                reverseNodeMap = {};
                portMap = {};
                portEndpointMap = {};
                portMaps.source = {};
                portMaps.target = {};
            });

            //
            // Notification that a new port was added to some node.  We want to find the corresponding element for the
            // given node, then render the portData using the current rendering mechanism, and finally hand off the node's
            // element and the renderer port element to a helper function (supplied as 'portAdded' to the constructor), for
            // the application to insert the port's UI component at the appropriate location. If no 'portAdded' callback
            // was supplied, we just append the port to the node.
            //
            // For an example of this, consider the database visualizer demo app.  when the user adds a new column it is
            // added as a 'port' to the table node.  We are given the portData and we render it using the column
            // template, but then where does this column get added?  We hand off to the app, and the app knows that it
            // should add the element to the UL that contains the table's columns.
            //
            _toolkit.bind(_e.portAdded, function (params) {
                var nodeEl = nodeMap[params.node.id];
                // get the port element rendered, and then hand it off to the helper, which is responsible for
                // appending it to the appropriate place in the UI.
                var portEl = portRenderer(params.port, params.data, params.node);
                portMap[params.node.id + _toolkit.getGraph().getPortSeparator() + params.port.id] = portEl;
                _checkForPorts(jsPlumb.getElement(portEl), params.node, params.node.id);
                self.fire(_e.portAdded, {
                    node: params.node,
                    nodeEl: nodeEl,
                    port: params.port,
                    portEl: portEl
                });
                _jsPlumb.recalculateOffsets(nodeEl);
                self.refresh(true);
            });

            //
            // Notification that a port was removed from some node.  We want to retrieve the associated node and
            // port elements, then hand off to a helper function (supplied as 'portRemoved' to the constructor) for
            // the application to remove the port's UI component.  If no 'portRemoved' callback was supplied we just
            // attempt to remove the port's element from its parent (which, for many applications, is probably
            // sufficient).
            //
            _toolkit.bind(_e.portRemoved, function (params) {
                var nodeEl = nodeMap[params.node.id], pId = params.node.id + "." + params.port.id,
                    portEl = portMap[pId];

                // remove the port element (suspend events while doing so)
                _jsPlumb.setSuspendEvents(true);
                _jsPlumb.remove(portEl);
                _jsPlumb.setSuspendEvents(false);

                delete portMap[pId];
                self.fire(_e.portRemoved, {
                    node: params.node,
                    port: params.port,
                    portEl: portEl,
                    nodeEl: nodeEl
                });
                _jsPlumb.recalculateOffsets(nodeEl);
                self.refresh(true);
            });

            //
            // Notification that an edge was updated.
            //
            _toolkit.bind(_e.edgeUpdated, function (p) {
                var conn = connMap[p.edge.getId()];
                if (conn) {
                    var newConnectionParameters = _prepareConnectionParams(p.edge);
                    conn.setType(newConnectionParameters.type, newConnectionParameters.data);
                }
            });

            //
            // Notification that a port was updated
            //
            _toolkit.bind(_e.portUpdated, function (p) {
                var portEl = portMap[p.port.getFullId()];
                if (portEl) {
                    // check if the current renderer is Rotors. If not, we don't have 2 way binding available.
                    if (typeof Rotors !== "undefined") {
                        _rotors.update(portEl, p.port.data);
                    }
                    // repaint the port's node element, not just the port's element.
                    self.repaint(nodeMap[p.node.id]);
                }
            });

            //
            // Notification that a node was updated.
            //
            _toolkit.bind(_e.nodeUpdated, function (p) {
                var nodeEl = nodeMap[p.node.getFullId()];
                if (nodeEl) {
                    // check if the current renderer is Rotors. If not, we don't have 2 way binding available.
                    if (typeof nodeEl._rotors !== "undefined") {
                        _rotors.update(nodeEl, p.node.data);
                    }

                    _checkForPorts(nodeEl, p.node, p.node.id);

                    var posse = posseAssigner(p.node);
                    if (posse != null) {
                        var args = jsPlumbUtil.isArray(posse) ? posse : [ posse ];
                        args.unshift(nodeEl);
                        _jsPlumb.addToPosse.apply(_jsPlumb, args);
                    }
                    else {
                        // remove from all Posses.
                        _jsPlumb.removeFromAllPosses(nodeEl);
                    }

                    self.repaint(nodeEl);
                }
            });

        }

// ----------------------------------------- views    -------------------------------------

        var view;
        /**
         * Sets the current view for this renderer.
         * @method setView
         * @param {Object} p View to set.
         */
        this.setView = function (p) {
            // we merge in the model that has optionally been registered on the toolkit
            // when we do this.  this allows us to register data model stuff on the toolkit (such as max
            // connections etc), and render level stuff on this object.
            var pp = JUTIL.merge(_toolkit.getModel(), p || {});
            view = new JTK.Model(pp, _jsPlumb);
        };

        // create a view.
        this.setView(params.view);

// --------------------------- UI states

        var currentStates = [];

        var _getStateTarget = function(target) {
            if (target == null) return _toolkit;
            else if (typeof target === "string") {
                return _toolkit.select(target, true);
            }
            else if (target.jtk) {
                return _toolkit.select(target.jtk.port || target.jtk.node, true);
            }
            else return target;
        };

        /**
         * Activates the UI state with the given ID on the objects contained in the given target. If target is not supplied, the state is
         * activated against the entire dataset.
         * @method activateState
         * @param {String} stateId ID of the state to activate. States are defined inside a `states` member of your `view` definition.
         * @param {Selection|Path|jsPlumbToolkitInstance|Element} [target] Set of objects to activate the state on. If null, the entire dataset (Nodes, Edges and Ports) is used. If you provide an Element here, a Selection is created that consists of the Node representing the element, plus all Edges to and from the given Node.
         */
        this.activateState = function (stateId, target) {
            var s = view.getState(stateId);
            if (s) {
                target = _getStateTarget(target);
                s.activate(target, self, _toolkit);
                currentStates.push(s);
            }
        };

        /**
         * Deactivates the UI state with the given ID on the objects contained in the given target. If target is not supplied, the state is
         * deactivated against the entire dataset.
         * @method deactivateState
         * @param {String} stateId ID of the state to deactivate. States are defined inside a `states` member of your `view` definition.
         * @param {Selection|Path|jsPlumbToolkitInstance} [target] Set of objects to deactivate the state on. If null, the entire dataset (Nodes, Edges and Ports) is used.
         */
        this.deactivateState = function (stateId, target) {
            var s = view.getState(stateId);
            if (s) {
                target = _getStateTarget(target);
                s.deactivate(target, self, _toolkit);
                jsPlumbUtil.removeWithFunction(currentStates, function (_s) {
                    return _s == s;
                });
            }
        };

        /**
         * Resets (clears) the UI state of all objects in the current dataset.
         * @method resetState
         */
        this.resetState = function () {
            for (var i = 0; i < currentStates.length; i++) {
                currentStates[i].deactivate(_toolkit, self, _toolkit);
            }
            currentStates.length = 0;
        };

// --------------------------- / UI states


        var _prepareConnectionParams = function (edge) {
            // we use jsPlumb's type system for edge appearance.
            var type = _edgeTypeFunction(edge.data),
                p = {
                    type: type,
                    connectionType:type,
                    // pass the 'data' object in; it is used if the edge type is parameterised at all.
                    data: edge.data,
                    cost: edge.getCost(),
                    directed: edge.isDirected()
                },
                td = view.getEdgeDefinition(type);

            // extra properties not supported by jsPlumb's type system: connector and endpoints/endpoint:
            (function(props) {
                if (td) {
                    for (var k = 0; k < props.length; k++) {
                        if (td[props[k]]) p[props[k]] = td[props[k]];
                    }
                }
            })(["connector", "endpoints", "endpoint", "endpointStyles", "endpointStyle"]);

            var _one = function (name) {
                if (edge[name].getNode) {
                    var n = edge[name].getNode(),
                        portIdentifier = edge[name].getFullId(),
                        ep = portEndpointMap[portIdentifier] || portMaps[name][portIdentifier];

                    if (ep != null) {
                        p[name] = ep;
                    }
                    else {
                        p[name] = portMap[portIdentifier];
                    }

                    // if still null, just use the node element.
                    if (p[name] == null) {
                        p[name] = nodeMap[_idFunction(n.data)];
                    }
                }
                else
                    p[name] = nodeMap[_idFunction(edge[name].data)];
            };

            _one("source");
            _one("target");

            return p;
        };

// ---------------------- create the default node renderer ---------------------------

        var createRenderer = function (objectType, idFunctionToUse, typeFunctionToUse, definitionResolver, defaultRenderFunction, makeDraggableIfRequired, jtkClass, jtkAttributeName) {
            return function (object, data, node) {

                var id = idFunctionToUse(data),
                    obj = null,
                    typeId = typeFunctionToUse(data),
                    def = view[definitionResolver](typeId),
                    _data = data,
                    i;

                // enhanced views are models supporting preconfigured values, and
                // functions as parameter values. This is switched on by default. If you use
                // something that does two-way data binding, such as angular, you will
                // probably want to switch it off, because creating a duplicate of the data here
                // causes the two-way binding to fail.
                if (enhancedView) {
                    _data = jsPlumb.extend({}, def ? def.parameters || {} : {});
                    // then merge node on top, so its values take priority.
                    jsPlumb.extend(_data, data);
                    var mappedData = {};
                    for (i in _data) {
                        if (_data.hasOwnProperty(i)) {
                            if (_data[i] != null) {
                                if (_data[i].constructor == Function)
                                    mappedData[i] = _data[i](data);
                                else
                                    mappedData[i] = _data[i];
                            }
                        }
                    }
                    _data = mappedData;
                }

                if (def) {
                    var tmplId = def.template || ("jtk-template-" + typeId);
                    if (!def.templateRenderer) {
                        obj = _thisTemplateRenderer.render(tmplId, _data, _toolkit);
                    }
                    else {
                        obj = def.templateRenderer(tmplId, _data, _toolkit);
                    }
                }
                else obj = defaultRenderFunction(_data, id);

                obj = _jsPlumb.getElement(obj);
                obj.setAttribute(jtkAttributeName, id);
                jsPlumb.addClass(obj, jtkClass);

                // write the data to the element.
                obj.jtk = obj.jtk || {};
                obj.jtk[objectType] = object;
                // always write node.
                obj.jtk.node = node;

                // only for nodes.
                if (makeDraggableIfRequired && draggable && handler.makeDraggable)
                    handler.makeDraggable(obj, def.dragOptions);

                if (droppable && handler.makeDroppable)
                    handler.makeDroppable(obj, def.dropOptions);

                // -------------- events -----------------------

                var _bindOne = function (evt) {
                    _jsPlumb.on(obj, evt, function (e) {
                        def.events[evt]({node: node, el: obj, e: e});
                    });
                };

                // EVENTS
                if (def && def.events) {
                    for (i in def.events) {
                        _bindOne(i);
                    }
                }

                return obj;
            };
        };

        var nodeRenderer = createRenderer("node", _idFunction, _typeFunction, "getNodeDefinition", _defaultNodeRenderFunction, true, _cl.NODE, atts.NODE);
        var portRenderer = createRenderer("port", _portIdFunction, _portTypeFunction, "getPortDefinition", _defaultNodeRenderFunction, false, _cl.PORT, atts.PORT);

        //
        this.initialize = function () {
            var i, n;
            _toolkit.setSuspendGraph(true);
            // suspend drawing until its all loaded
            _jsPlumb.setSuspendDrawing(true);

            // if a jsPlumb instance was not supplied, we've just created one and it will be empty. we load any
            // data that is in the toolkit.
            if (!params.jsPlumbInstance) {

                // now add nodes for all vertices
                for (i = 0; i < _toolkit.getNodeCount(); i++) {
                    n = _toolkit.getNodeAt(i);
                    _doRenderNode(n);
                }

                // next, connect all nodes
                for (i = 0; i < _toolkit.getNodeCount(); i++) {
                    n = _toolkit.getNodeAt(i);
                    if (nodeMap[n.id]) {
                        var edges = _toolkit.getAllEdgesFor(n);
                        for (var j = 0; j < edges.length; j++) {
                            if (edges[j].source == n || edges[j].source.getNode && edges[j].source.getNode() == n) {
                                var def = view.getEdgeDefinition(_typeFunction(edges[j].data));
                                if (def && def.ignore === true) continue;
                                var connectionParams = _prepareConnectionParams(edges[j]);
                                connectionParams.doNotFireConnectionEvent = true;
                                var conn = _jsPlumb.connect(connectionParams);
                                if (conn != null) {
                                    conn.edge = edges[j];
                                    connMap[edges[j].getId()] = conn;
                                    _maybeAttachEdgeEvents(connectionParams.type, edges[j], conn);
                                }
                            }
                        }
                    }
                }
            }
            else {
                // otherwise we have to go through all the nodes and edges in the instance and register them as if they had run through
                // our normal rendering process.
                var c = params.jsPlumbInstance.select();
                c.each(function (conn) {
                    connMap[conn.edge.getId()] = conn;
                });
                var n = params.jsPlumbInstance.getManagedElements();
                for (var id in n) {
                    var el = n[id].el;
                    nodeMap[el.jtk.node.id] = el;
                    reverseNodeMap[params.jsPlumbInstance.getId(el)] = el.jtk.node;
                }
                if (handler.doImport) handler.doImport(nodeMap, connMap);
            }

            this.relayout();
            _jsPlumb.setSuspendDrawing(false, true);
            _toolkit.setSuspendGraph(false);
        };

        this.getContainer = function () {
            return containerElement;
        };
        this.getContainerId = function () {
            return containerId;
        };

        /**
         * Gets the DOM node that was rendered for the given Node/Port.
         * @method getRenderedElement
         * @param {Node|Port} obj Node or Port for which to retrieve the rendered element.
         * @return {Element} DOM element for the given Node/Port, null if not found.
         */
        this.getRenderedElement = function (obj) {
            return (obj.objectType === "Port" ? portMap : nodeMap)[obj.getFullId()];
        };

        /**
         * Gets the DOM node that was rendered for the Node with the given id.
         * @method getRenderedNode
         * @param {String} nodeId Node id for which to retrieve the rendered element.
         * @return {Element} DOM element for the given Node id, null if not found.
         */
        this.getRenderedNode = function (nodeId) {
            return nodeMap[nodeId];
        };

        /**
         * Gets the DOM node that was rendered for the Port with the given id.
         * @method getRenderedPort
         * @param {String} portId Port id for which to retrieve the rendered element. Note that you must supply the "full" id here, that is in dotted
         * notation with the id of the Node on which the port resides.
         * @return {Element} DOM element for the given Port id, null if not found.
         */
        this.getRenderedPort = function (portId) {
            return portMap[portId];
        };

        /**
         * Gets the underlying jsPlumb connection that was rendered for the Edge with the given id.
         * @method getRenderedConnection
         * @param {String} edgeId ID of the Edge to retrieve the Connection for.
         * @return {Connection} A jsPlumb Connection, null if not found.
         */
        this.getRenderedConnection = function (edgeId) {
            return connMap[edgeId];
        };

        //
        // helper method to create a layout. used by setLayout and adHocLayout.
        //
        var _createLayout = function(layoutParams) {
            var lp = _jsPlumb.extend({
                container: containerElement,
                getElementForNode: function (id) {
                    return nodeMap[id];
                }
            }, layoutParams);
            lp.jsPlumbToolkit = _toolkit;
            lp.adapter = self;

            if (!root.jsPlumbToolkit.Layouts[lp.type]) throw "no such layout [" + lp.type + "]";

            // potentially insert locationFunction, if there isn't one.
            if (!lp.locationFunction) {
                lp.locationFunction = function(node) {
                    return [ Rotors.data(node.data, _modelLeftAttribute), Rotors.data(node.data, _modelTopAttribute) ];
                }
            }

            return new root.jsPlumbToolkit.Layouts[lp.type](lp);
        };

        /**
         * Applies the given layout one time to the content.
         * @method adHocLayout
         * @param {Object} layoutParams Parameters for the layout, including type and constructor parameters.
         */
        this.adHocLayout = function(layoutParams) {
            if (layoutParams) {
                var _originalLayout = _layout;
                this.setLayout(layoutParams);
                _layout = _originalLayout; // (but dont refresh)
            }
        };

        /**
         * Sets the current layout.
         * @method setLayout
         * @param {Object} layoutParams Parameters for the layout, including type and constructor parameters.
         * @param {Boolean} [doNotRefresh=false] Do not refresh the UI after setting the new layout.
         */
        this.setLayout = function (layoutParams, doNotRefresh) {
            if (layoutParams) {
                _layout = _createLayout(layoutParams);
                if (!doNotRefresh) self.refresh();
            }
        };

        /**
         * Gets the current layout.
         * @method getLayout
         * @return {Layout} The current layout.
         */
        this.getLayout = function () {
            return _layout;
        };

        /**
         * Magnetize the display. You must indicate what sort of magnetization you wish to perform: if you provide an event,
         * the event's location will be the magnetization origin. If you provide `origin:{left;xxx, top:xxx}`, that value will be used. If
         * you provide neither, the computed center of all elements will be used. You can also provide an `options:{...}` value, whose
         * values can contain `filter`, `constrain` and `padding` values for the specific run of the magnetizer.
         * @param {Object} [params] Magnetize parameters. If omitted, the origin of magnetization will be the computed center of all the elements.
         * @param {Event} [params.event] If provided, the event location will be used as the origin of magnetization.
         * @param {Object} [params.origin] An object with `left` and `top` properties. If provided, will be used as the origin of magnetization.
         * @param {Object} [params.options] Extra magnetizer options for this run of the magnetizer.
         */
        this.magnetize = function(params) {
            if (_layout != null) _layout.magnetize(params);
        };

        /**
         * Incrementally update the layout, without a reset. If rendering is suspended, this method does nothing.
         * @method refresh
         */
        this.refresh = function (_internal) {
            if (!_suspendRendering && (!_internal || _refreshAutomatically)) {
                if (_layout)
                    _layout.layout(function () {
                        window.setTimeout(_jsPlumb.repaintEverything, 0)
                    });
                else
                    _jsPlumb.repaintEverything();
            }
        };

        /**
         * Sets whether or not the layout is refreshed automatically after a Node or Port is added or removed.
         * @method setRefreshAutomatically
         * @param {Boolean} refreshAutomatically True to refresh automatically, false otherwise.
         */
        this.setRefreshAutomatically = function (refreshAutomatically) {
            _refreshAutomatically = refreshAutomatically;
        };

        /**
         * Reset the layout and run it again.  This is different to `refresh` in that `refresh` does not reset the layout first.
         * @method relayout
         * @param {Object} [newParameters] Optional new parameters for the layout.
         */
        this.relayout = function (newParameters) {
            if (!_suspendRendering) {
                if (_layout) {
                    _layout.relayout(newParameters, function () {
                        _jsPlumb.repaintEverything();
                        this.fire("relayout", this.getBoundsInfo());
                    }.bind(this));

                }
                else
                    _jsPlumb.repaintEverything();
            }
        };

        /**
         * Gets a Path from some source Node/Port to some target Node/Port. This method is a wrapper around the
         * Toolkit's `getPath` method, adding a `setVisible` function to the result.
         * @param {Object} params Path spec params
         * @param {Node|Port|String} params.source Source node or port, or id of source node/port
         * @param {Node|Port|String} params.target Target node or port, or id of target node/port
         * @param {Boolean} [params.strict=true] Sets whether or not paths are searched strictly by the given source/target. If, for instance, you supply a node as the source, but there are only edges connected to ports on that node, by default these edges will be ignored. Switching `strict` to false will mean these edges are considered.
         * @param {Function} [params.nodeFilter] Optional function that is given each Node's backing data and asked to return true or false - true means include the Node, false means exclude it.
         * @param {Function} [params.edgeFilter] Optional function that is given each Edge's backing data and asked to return true or false - true means include the Edge, false means exclude it.
         * @return {Path} a Path object. Even if no path exists you will get a return value - but it will just be empty.
         */
        this.getPath = function (params) {
            var p = _toolkit.getPath(params);
            if (p) {
                p.setVisible = function (val) {
                    self.setVisible(p, val);
                };
                p.addNodeClass = function (clazz) {
                    p.eachNode(function (i, n) {
                        _jsPlumb.addClass(nodeMap[n.id], clazz);
                    });
                };
                p.removeNodeClass = function (clazz) {
                    p.eachNode(function (i, n) {
                        _jsPlumb.removeClass(nodeMap[n.id], clazz);
                    });
                };
                p.addEdgeClass = function (clazz) {
                    p.eachEdge(function (i, e) {
                        connMap[e.getId()].addClass(clazz);
                    });
                };
                p.removeEdgeClass = function (clazz) {
                    p.eachEdge(function (i, e) {
                        connMap[e.getId()].removeClass(clazz);
                    });
                };

                p.addClass = function (clazz) {
                    this.addNodeClass(clazz);
                    this.addEdgeClass(clazz);
                };

                p.removeClass = function (clazz) {
                    this.removeNodeClass(clazz);
                    this.removeEdgeClass(clazz);
                };
            }
            return p;
        };

        /**
         * Gets the position of an element that is being managed by the Surface.
         * @method getPosition
         * @param {String|Element|Selector|Node} el Element id, element, selector or Node to get position for.
         * @return {Number[]|Null} [left,top] position array if element found, otherwise null.
         */
        this.getPosition = function (el) {
            var l = this.getLayout();
            if (l) {
                var id = _getObjectInfo(el).id;
                return l.getPosition(id);
            }
        };

        /**
         * Gets the size of an element that is being managed by the Surface.
         * @method getSize
         * @param {String|Element|Selector|Node} el Element id, element, selector or Node to get position for.
         * @return {Number[]|Null} [width, height] Array if element found, otherwise null.
         */
        this.getSize = function (el) {
            return _jsPlumb.getSize(_getObjectInfo(el).el);
        };

        /**
         * Gets the origin and size of an element that is being managed by the Surface.
         * @method getCoordinates
         * @param {String|Element|Selector|Node} el Element id, element, selector or Node to get position for.
         * @return {Object} {x:.., y:..., w:..., h:...} if element found, otherwise null.
         */
        this.getCoordinates = function (el) {
            var l = this.getLayout();
            if (l) {
                var info = _getObjectInfo(el),
                    p = l.getPosition(info.id),
                    s = _jsPlumb.getSize(info.el);

                return { x: p[0], y: p[1], w: s[0], h: s[1] };
            }
        };

        var portEndpointMap = {}, portMaps = {
            source: {},
            target: {}
        };

        var _getPortParameters = function (fromEl, node, nodeId) {

            var portId = fromEl.getAttribute("port-id"),
                portType = fromEl.getAttribute("port-type") || "default",
                portScope = fromEl.getAttribute("scope") || _jsPlumb.getDefaultScope(),

                nodeType = _typeFunction(node),
                nodeDefinition = view.getNodeDefinition(nodeType),
                portDefinition = view.getPortDefinition(portId, nodeDefinition),
                portTypeDefinition = view.getPortDefinition(portType, nodeDefinition),
                mergedPortDefinition = JUTIL.merge(portTypeDefinition, portDefinition),
                params = mergedPortDefinition == null ? {} : UTIL.populate(mergedPortDefinition, node.data),

                _curryListener = function (listener) {
                    return function (info) {
                        var port = node.getPort(portId),
                            args = [
                                {
                                    portId: portId,
                                    nodeId: nodeId,
                                    port: port,
                                    node: node,
                                    portType: portType,
                                    endpoint: info.endpoint,
                                    anchor: info.anchor
                                }
                            ];
                        listener.apply(listener, args);
                    };
                },
                _curryInterceptor = function (interceptor) {
                    return function (info) {
                        var args = [
                            {
                                connection: info.connection || info,
                                source: _getObjectInfo(info.source),
                                target: _getObjectInfo(info.target),
                                scope: info.scope
                            }
                        ];
                        return interceptor.apply(interceptor, args);
                    };
                };

            // Use 'default' as the edge default if there is not one provided via the port definition,
            // and edge-type was not given in the attributes.
            var edgeType = params.edgeType || fromEl.getAttribute("edge-type") || "default";

            // expand out the edge type.
            var mappings = {
                    "paintStyle": "connectorStyle",
                    "hoverPaintStyle": "connectorHoverStyle",
                    "overlays": "connectorOverlays",
                    "endpointStyle": "paintStyle"
                },
                edgeParams = view.getEdgeDefinition(edgeType);

            if (edgeParams) {
                for (var i in edgeParams) {
                    var m = mappings[i] || i;
                    params[m] = edgeParams[i];
                }
            }
            params.connectionType = edgeType;

            params.portId = portId;
            params.portType = portType;
            params.scope = portScope;

            // set jsplumb parameters
            params.parameters = params.parameters || {};
            params.parameters.portId = portId;
            params.parameters.portType = portType;
            params.parameters.scope = portScope;
            params.parameters.nodeId = nodeId;

            params.events = {};
            if (mergedPortDefinition.events) {
                for (i in mergedPortDefinition.events) {
                    params.events[i] = _curryListener(mergedPortDefinition.events[i]);
                }
            }

            // interceptors are eg beforeDrop, beforeDetach. They go straight onto the endpoint definition.
            if (mergedPortDefinition.interceptors) {
                for (i in mergedPortDefinition.interceptors)
                    params[i] = _curryInterceptor(mergedPortDefinition.interceptors[i]);
            }

            // event capture
            params.events.anchorChanged = function (info) {
                self.fire("anchorChanged", {
                    portId: portId,
                    nodeId: nodeId,
                    portType: portType,
                    node: node,
                    port: node.getPort(portId),
                    endpoint: info.endpoint,
                    anchor: info.anchor
                });
            };

            return params;
        };

        var _checkForPorts = function (el, node, nodeId, depth) {

            depth = depth || 0;
            var i;

            // get port parameters from some element


            if (el.childNodes) {
                var nodesToRemove = [], portParameters;
                for (i = 0; i < el.childNodes.length; i++) {
                    if (el.childNodes[i].nodeType != 3 && el.childNodes[i].nodeType != 8) {

                        // JTK-PORT element
                        if (el.childNodes[i].tagName.toUpperCase() == els.PORT && el.childNodes[i].getAttribute("jtk-processed") == null) {
                            portParameters = _getPortParameters(el.childNodes[i], node, nodeId);
                            var ep = _jsPlumb.addEndpoint(el, portParameters);
                            // store the mapping from node.port to endpoint
                            portEndpointMap[nodeId + "." + portParameters.portId] = ep;
                            // add a port to the node.
                            var port = node.addPort({id: portParameters.portId});
                            // mark processed
                            el.childNodes[i].setAttribute("jtk-processed", true);

                            ep.graph = {
                                node: node,
                                port: port
                            };
                            if (typeof Rotors != "undefined") {
                                _rotors.onUpdate(el, function (el, newData) {

                                });
                            }
                        }
                        // JTK-SOURCE element
                        if (el.childNodes[i].tagName.toUpperCase() == els.SOURCE && el.childNodes[i].getAttribute("jtk-processed") == null) {
                            var cn = el.childNodes[i];
                            portParameters = _getPortParameters(cn, node, nodeId);
                            var filter = cn.getAttribute("filter");

                            //if (depth != 0) {
                            if (portParameters.portId != null) {
                                // if  port id was provided, add a port to the node and save the mapping
                                // to the element.
                                portMaps.source[nodeId + "." + portParameters.portId] = el;
                                // add a port to the node.
                                _toolkit.addPort(node, {id: portParameters.portId}, true);
                            }

                            // if the user supplied a selector to the filter attribute, pass it over.
                            // by default the filter is _inclusive_, meaning anything it identifies is a valid
                            // drag point. You can set `filter-exclude` to be true to negate this behaviour.
                            if (filter) {
                                var filterExclude = cn.getAttribute("filter-exclude"),
                                    fn = filterExclude === "true";
                                portParameters.filter = filter;
                                portParameters.filterExclude = fn;
                            }

                            // do not support uniqueEndpoint in toolkit. use beforeStartConnect in toolkit
                            // instead.
                            delete portParameters.uniqueEndpoint;

                            // grab any data-*** attributes and provide them to the makeSource call: they indicate
                            // attributes we want to read off the source element when drag starts, and whose values
                            // will be written into the edge data.
                            portParameters.extract = {};
                            for (var n = 0; n < cn.attributes.length; n++) {
                                var att = cn.attributes[n];
                                if (att.name.indexOf("data-") === 0) {
                                    portParameters.extract[att.value] = att.name.split("-")[1];
                                }
                            }

                            _jsPlumb.makeSource(el, portParameters);
                            el.childNodes[i].setAttribute("jtk-processed", true);

                            if (typeof Rotors != "undefined") {
                                _rotors.onUpdate(el, function (el, newData) {
                                    var portEl = jsPlumb.getSelector(el, "jtk-source");
                                    if (portEl.length == 1) {
                                        // get port type and scope
                                        var newPortParams = _getPortParameters(portEl[0], node, nodeId);
                                        if (newPortParams.scope) {
                                            _jsPlumb.setSourceScope(el, newPortParams.scope, newPortParams.edgeType);
                                        }
                                    }
                                });
                            }
                        }
                        // JTK-TARGET element
                        if (el.childNodes[i].tagName.toUpperCase() == els.TARGET && el.childNodes[i].getAttribute("jtk-processed") == null) {
                            portParameters = _getPortParameters(el.childNodes[i], node, nodeId);

                            if (depth != 0) {
                                // save target port mapping for element, unless depth == 0, in which
                                // case the node itself is being made a target.
                                portMaps.target[nodeId + "." + portParameters.portId] = el;
                                // add a port to the node.
                                _toolkit.addPort(node, {id: portParameters.portId}, true);
                            }

                            _jsPlumb.makeTarget(el, portParameters);
                            // mark processed
                            el.childNodes[i].setAttribute("jtk-processed", true);

                            if (typeof Rotors != "undefined") {
                                _rotors.onUpdate(el, function (el, newData) {
                                    var portEl = jsPlumb.getSelector(el, "jtk-target");
                                    if (portEl.length == 1) {
                                        // get port type and scope
                                        var newPortParams = _getPortParameters(portEl[0], node, nodeId);
                                        if (newPortParams.scope) {
                                            _jsPlumb.setTargetScope(el, newPortParams.scope);
                                        }
                                    }
                                });
                            }
                        }

                        _checkForPorts(el.childNodes[i], node, nodeId, depth + 1);
                    }
                }
                for (i = 0; i < nodesToRemove.length; i++)
                    nodesToRemove[i].parentNode.removeChild(nodesToRemove[i]);
            }
        };

        this.setLayout(params.layout, true);

        /**
         * Writes the current left/top for each node into the data model. A common use case is to run an auto layout the first time
         * some dataset is seen, and then to save the locations of all the nodes once a human being has moved things around.
         * @method storePositionsInModel
         * @param {Object} params Parameters
         * @param {String} [params.leftAttribute] Name of the attribute to use for the left position. Default is 'left'
         * @param {String} [params.topAttribute] Name of the attribute to use for the top position. Default is 'top'
         */
        this.storePositionsInModel = function (params) {
            params = params || {};
            var la = params.leftAttribute || "left",
                ta = params.topAttribute || "top";

            var p = _layout.getPositions();
            for (var i in p) {
                var node = _toolkit.getNode(i);
                Rotors.data(node.data, la, p[i][0]);
                Rotors.data(node.data, ta, p[i][1]);
            }
        };

        /**
         * Writes the current left/top for some node into the data model. A common use case is to run an auto layout the first time
         * some dataset is seen, and then to save the locations of all the Nodes once a human being has moved things around. Note that this method
         * takes either a String, representing the Node's ID, and uses the default values for left/top attribute names, or an Object, in which
         * you provide the id and the left/top attribute names.
         * @method storePositionInModel
         * @param {String} id ID of the node for which to store the position. Either supply this, or an object containing id and values for the left/top attribute names.
         * @param {Object} params Parameters. An object containing id and values for the left/top attribute names. Supply this or just supply the node id as a string.
         * @param {Integer} params.id node id
         * @param {String} [params.leftAttribute] Name of the attribute to use for the left position. Default is 'left'.
         * @param {String} [params.topAttribute] Name of the attribute to use for the top position. Default is 'top'.
         * @return {Integer[]} The current position as [left, top].
         */
        this.storePositionInModel = function (params) {
            var id = typeof params == "string" ? params : params.id;

            var la = typeof params == "string" ? "left" : (params.leftAttribute || "left"),
                ta = typeof params == "string" ? "top" : (params.topAttribute || "top"),
                np = _layout.getPosition(id),
                node = _toolkit.getNode(id);

            if (node) {
                Rotors.data(node.data, la, np[0]);
                Rotors.data(node.data, ta, np[1]);
            }
            return np;
        };

        var _doSetPosition = function(info, node, x, y, doNotUpdateElement, animateFrom, animateOptions) {
            info = info || _getObjectInfo(node);
            if (info) {
                _layout.setPosition(info.id, x, y);
                if (!doNotUpdateElement) {
                    _jsPlumb.setAbsolutePosition(info.el, [x, y], animateFrom, animateOptions);
                    _jsPlumb.revalidate(info.el);
                }
            }
            return info;
        };

        /**
         * Sets the position of the given node.
         * @method setPosition
         * @param {String|Node|Element} node Either a Node id, a DOM element representing a Node, or a Node.
         * @param {Integer} x left position for the element.
         * @param {Integer} y top position for the element.
         * @param {Boolean} [doNotUpdateElement=false] If true, the DOM element will not be moved. This flag is used internally by various Toolkit methods; most external calls to this method will want the element to be moved.
         */
        this.setPosition = function (node, x, y, doNotUpdateElement) {
            return _doSetPosition(null, node, x, y, doNotUpdateElement);
        };

        /**
         * Sets the position of the given node, animating the element to that position.
         * @param {String|Node|Element} node Either a Node id, a DOM element representing a Node, or a Node.
         * @param {Integer} x left position for the element.
         * @param {Integer} y top position for the element.
         * @param {Object} [animateOptions] Options for the animation.
         */
        this.animateToPosition = function(node, x, y, animateOptions) {
            var info =_getObjectInfo(node);
            if (info) {
                var p = _layout.getPosition(info.id);
                _doSetPosition(info, node, x, y, false, [p[0], p[1]], animateOptions);
            }
        };

        /**
         * Sets the visibility of some Node/Port or Edge.
         * @method setVisible
         * @param {Selection|Path|Edge|Node|Port|String|Node[]|Port[]|Edge[]|String[]} obj An Edge, Port, Node or - in the case of String - a  Node/Port id.
         * @param {Boolean} state Whether the object should be visible or not.
         * @param {Boolean} [doNotCascade=false] If true, the method does not cascade visibility changes down from a Node to its connected Edges, or from an Edge to its Ports. The default is for this to happen.
         */
        this.setVisible = function (obj, state, doNotCascade) {
            if (obj == null) return;

            var _toggleEdge = function (edge) {
                var c = _getConnectionForEdge(edge);
                c && c.setVisible(state);
                if (!doNotCascade) {
                    c.endpoints[0].setVisible(state);
                    c.endpoints[1].setVisible(state);
                }
            };
            var _toggleNode = function (node, el) {
                if (el) {
                    el.style.display = state ? "block" : "none";
                    if (!doNotCascade) {
                        var edges = _toolkit.getAllEdgesFor(node);
                        for (var i = 0; i < edges.length; i++)
                            _toggleEdge(edges[i]);
                    }
                }
            };

            var _togglePort = function (port) {
                var id = port.getFullId(),
                    ep = portEndpointMap[id];

                ep.setVisible(state);
            };

            var _one = function (_obj) {
                var info = _getObjectInfo(_obj);
                switch (info.type) {
                    case "Edge":
                        _toggleEdge(info.obj);
                        break;
                    case "Node":
                        _toggleNode(info.obj, info.el);
                        break;
                    case "Port":
                        _togglePort(info.obj);
                        break;
                }
            };

            // if a Selection or Path (or a Toolkit instance), iterate.
            if (obj.eachNode && obj.eachEdge) {
                obj.eachNode(function (i, n) {
                    _one(n);
                });
                obj.eachEdge(function (i, e) {
                    _one(e);
                });
            }
            else if (obj.length && typeof(obj) !== "string") {
                for (var i = 0; i < obj.length; i++)
                    _one(obj[i]);
            }
            else {
                // otherwise its just a single object.
                _one(obj);
            }

        };

        var _getObjectInfo = function (obj) {
            if (obj instanceof _jsPlumb.getDefaultConnectionType())
                obj = obj.edge;

            return _toolkit.getObjectInfo(obj, function (obj) {
                return obj.getNode ? portMap[obj.id] : nodeMap[obj.id];
            });
        };

        /**
         * Add the given Node to the posse with the given name
         * @param {Element|String|Node} obj A DOM element representing a Node, or a Node id, or a Node.
         * @param {String...|Object...} spec Variable args parameters. Each argument can be a either a String, indicating
         * the ID of a Posse to which the element should be added as an active participant, or an Object containing
         * `{ id:"posseId", active:false/true}`. In the latter case, if `active` is not provided it is assumed to be
         * true.
         */
        this.addToPosse = function(obj, spec) {
            jsPlumbToolkitUtil.each(obj, function(_obj) {
                var info = _getObjectInfo(_obj);
                if (info.el) _jsPlumb.addToPosse(info.el, spec);
            });
        };

        /**
         * Remove the given Node from the given Posse.
         * @param {Element|String|Node} obj A DOM element representing a Node, or a Node id, or a Node.
         * @param {String} posseId ID of the posse from which to remove the Node from.
         */
         this.removeFromPosse = function(obj, posseId) {
            jsPlumbToolkitUtil.each(obj, function(_obj) {
                var info = _getObjectInfo(_obj);
                if (info.el) _jsPlumb.removeFromPosse(info.el, posseId);
            });
        };

        /**
         * Remove the given Node from all Posses to which it belongs.
         * @param {Element|String|Node} obj A DOM element representing a Node, or a Node id, or a Node.
         */
        this.removeFromAllPosses = function(obj) {
            jsPlumbToolkitUtil.each(obj, function(_obj) {
                var info = _getObjectInfo(_obj);
                if (info.el) _jsPlumb.removeFromAllPosses(info.el);
            });
        };

        var handler = {
            jsPlumb: _jsPlumb,
            toolkit: _toolkit,
            container: containerElement,
            containerId: containerId,
            getConnectionsForEdges: _getConnectionsForEdges,
            getConnectionForEdge: _getConnectionForEdge,
            getElement: function (nodeId) {
                return nodeMap[nodeId];
            },
            getNodeForElementId: function (elementId) {
                return reverseNodeMap[elementId];
            },
            getObjectInfo: _getObjectInfo,
            nodeMap: nodeMap,
            reverseNodeMap: reverseNodeMap
        };
        return handler;
    };

    /*
     * DOMElementRenderer
     *
     * A basic Renderer that can have a Layout applied but offers no extra functionality such as zoom/pan etc. This
     * Renderer simply drops elements onto the DOM.
     */
    exports.DOM = function (params) {
        AbstractRenderer.apply(this, arguments);
        DOMElementAdapter.apply(this, arguments);
    };

}).call(this);

;
/**
 * Wheel listener. Normalises wheel events across browsers.
 *
 */
(function () {

    "use strict";
    var root = this;

    var profiles = {
            "webkit": {
                "mac": function (e) {
                    return e.deltaY / 120;
                },
                "win": function (e) {
                    return e.deltaY / 100;
                }
            },
            "safari": function (e) {
                return e.wheelDeltaY / 120;
            },
            "firefox": {
                "mac": function (e) {
                    return -1 * (e.deltaY * ( e.deltaMode == 1 ? 25 : 1)) / 120;
                },
                "win": function (e) {
                    return -1 * e.deltaY / 3;
                }
            },
            "ie": function (e) {
                return e.wheelDelta / 120;
            },
            "default": function (e) {
                return e.deltaY || e.wheelDelta;
            }
        },
        _os = /Mac/.test(navigator.userAgent) ? "mac" : "win",   // linux?
        _browser = navigator.userAgent.indexOf("Firefox") != -1 ? "firefox" :
            /Safari/.test(navigator.userAgent) ? "safari" :
                /WebKit/.test(navigator.userAgent) ? "webkit" :
                    /Trident/.test(navigator.userAgent) ? "ie" :
                        "default",
        _profile = typeof profiles[_browser] === "function" ? profiles[_browser] : profiles[_browser][_os],
        _distance = function (evt) {
            return _profile(evt || event);
        },
        _wrap = function (callback, ignoreTouchWheelEvents) {

            return function (e) {
                // Firefox posts wheel events for a single touch moving on an element. we may not want that;
                // so if the user set the flag, here we test for the existence of the mozInputSource member, and
                // if it is not 1 (mouse device) then we return.
                if (ignoreTouchWheelEvents && e.mozInputSource != null && e.mozInputSource !== 1) return;

                e.normalizedWheelDelta = _distance(e);
                callback(e);
            };
        },
        supportedEvent = "onwheel" in document.createElement("div") ? "wheel" : // Modern browsers support "wheel"
                document.onmousewheel !== undefined ? "mousewheel" : // Webkit and IE support at least "mousewheel"
            "DOMMouseScroll"; // let's assume that remaining browsers are older Firefox

    root.addWheelListener = function (el, callback, ignoreTouchWheelEvents) {
        var _cb = _wrap(callback, ignoreTouchWheelEvents);
        if (el.addEventListener) {
            el.addEventListener(supportedEvent, _cb, false);     // Chrome/Safari/Opera
        }
        else if (el.attachEvent) {
            el.attachEvent('onmousewheel', _cb);                  // IE
        }
    };

}).call(this);

/**
 * Pinch listener for all touch browsers - ipad, android, and windows laptops/surfaces. Needless to say,
 * every browser does it differently. IE10+ uses PointerEvents; ipad safari/windows chrome/ipad chrome/
 * android chrome use TouchEvents.  The listener posts pinchstart, pinch happening, and pinch end events.
 */
;(function() {

    var exports = this;

    exports.PinchListener= function(params) {

        var isPointerDevice = "onpointerdown" in document.documentElement,
            isTouchDevice = "ontouchstart" in document.documentElement,
            center = [0,0],
            radius = 0,
            startRadius = 0,
            _fire = function(evt) {
                params[evt](center, startRadius, radius, radius / startRadius);
            },
            _fireEnd = function() { params.onPinchEnd();},
            ON_PINCH_START = "onPinchStart",
            ON_PINCH = "onPinch",
            POINTER_DOWN = "pointerdown", POINTER_MOVE = "pointermove", POINTER_UP = "pointerup",
            TOUCH_START = "touchstart", TOUCH_MOVE = "touchmove", TOUCH_END = "touchend";

        //
        // calc distance between two points
        //
        var _d = function (x1, y1, x2, y2) {
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        };

        var listenerTypes = {
            "pointer":function() {
                var anchorMap = {},
                    anchors = [],
                    downCount = 0,
                    needsReset = false;

                var _compute = function() {
                    if (downCount == 2) {
                        center = [
                            (anchors[1].p[0] + anchors[0].p[0]) / 2,
                            (anchors[1].p[1] + anchors[0].p[1]) / 2
                        ];
                        radius = _d(anchors[1].p[0], anchors[1].p[1], anchors[0].p[0], anchors[0].p[1]);
                    }
                };

                var _down = function(e) {
                    // we ignore anything more than 2 anchors, or if a pointer was released and we are
                    // awaiting reset.
                    if (downCount >= 2 || needsReset) return;
                    anchors[downCount] = {e:e, p:[e.pageX, e.pageY] };
                    anchorMap["" + e.pointerId] = downCount;
                    downCount++;
                    _compute();
                    if (downCount == 2) {
                        startRadius = radius;
                        _fire(ON_PINCH_START);
                    }
                };

                var _up = function(e) {
                    var idx = anchorMap["" + e.pointerId];
                    if (idx != null) {
                        delete anchorMap["" + e.pointerId];
                        downCount--;
                        // once a finger is removed, we bail until all fingers have been removed and we can start over.
                        needsReset = downCount !== 0;
                        _fireEnd();
                    }
                };

                var _move = function(e) {
                    if (needsReset || downCount != 2) return;
                    var idx = anchorMap[e.pointerId];
                    if (idx != null) {
                        anchors[idx].p = [e.pageX, e.pageY]; // update this pointer's position.
                        _compute();  // recomputer and fire event.
                        _fire(ON_PINCH);
                    }
                };

                params.bind(params.el, POINTER_DOWN, _down);
                params.bind(document, POINTER_UP, _up);
                params.bind(document, POINTER_MOVE, _move);
            },
            "touch":function(params) {
                // for ipad/android and chrome on touch devices.
                var _touches = function(e) {
                    return e.touches || [];
                };

                //
                // extracts the touch with the given index from the list of touches
                //
                var _getTouch = function (touches, idx) {
                    return touches.item ? touches.item(idx) : touches[idx];
                };

                //
                // calculates the distance between the first two touches in the list
                //
                var distance = function (touches) {
                    var t1 = _getTouch(touches, 0), t2 = _getTouch(touches, 1);
                    return _d(t1.pageX, t1.pageY, t2.pageX, t2.pageY);
                };

                //
                // calculates the center point of the first two touches in the list.
                //
                var _center = function (touches) {
                    var t1 = _getTouch(touches, 0), t2 = _getTouch(touches, 1);
                    return [ ( t1.pageX + t2.pageX) / 2, (t1.pageY + t2.pageY) / 2 ];
                };

                var down = false;

                var _down = function(e) {
                    var touches= _touches(e);
                    if (touches.length == 2 && params.enableWheelZoom !== false) {
                        center = _center(touches);
                        radius = startRadius = distance(touches);
                        down = true;
                        params.bind(document, TOUCH_MOVE, _move);
                        params.bind(document, TOUCH_END, _up);
                        _fire(ON_PINCH_START);
                    }
                };

                var _up = function(e) {
                    down = false;
                    params.unbind(document, TOUCH_MOVE, _move);
                    params.unbind(document, TOUCH_END, _up);
                    _fireEnd();
                };

                var _move = function(e) {
                    if (down) {
                        var touches = _touches(e);
                        if (touches.length == 2) {
                            radius = distance(touches);
                            center = _center(touches);
                            _fire(ON_PINCH);
                        }
                    }
                };

                params.bind(params.el, TOUCH_START, _down);

            }
        };

        if (isPointerDevice) listenerTypes.pointer(params);
        else if (isTouchDevice) listenerTypes.touch(params);
    };

}).call(this);
;
(function () {

    "use strict";

    /**
     * Provides Pan/Zoom functionality.
     * @class ZoomWidget
     * @constructor
     * @param {Object} params Constructor parameters
     * @param {Selector|Element} params.canvas The element to apply pan/zoom to.
     * @param {Selector|Element} params.viewport The element that will act as the viewport for the canvas.
     * @param {Function} params.bind Function that can bind to an event on an element.
     * @param {Function} params.unbind Function that can unbind from an event on an element.
     * @param {Function} params.height A function that can return the height for some element.
     * @param {Function} params.width A function that can return the width for some element.
     * @param {Function} params.offset A function that can return {left:.., top:..} for some element
     * @param {Function} params.id A function that can return an id for some element.
     * @param {Function} [params.domElement] A function that can translate between objects referenced by the widget and DOM elements. It might be
     * the case that no tranlation is required - you deal only in DOM elements. But also you might use this with jQuery,
     * and pass around jQuery selectors. So this function just normalises elements. If not supplied, the default function
     * assumes elements are already DOM elements.
     * @param {Object} [params.events] Optional map of event handlers
     * @param {Function} [params.events.zoom] Optional function callback for when zoom changes.
     * @param {Function} [params.events.pan] Optional function callback for when pan changes.
     * @param {Function} [params.events.mousedown] Optional function callback for mousedown event.
     * @param {Function} [params.events.mouseup] Optional function callback for mouseup event.
     * @param {Function} [params.events.mousemove] Optional function callback for mousemove event.
     * @param {Function} [params.events.maybeZoom] Optional interceptor for zoom. Returning false prevents zoom from occurring.
     * @param {Function} [params.events.transformOrigin] Optional function callback for transform origin change. This is given the [x,y] (in percent) of the new origin, and the [left, top] (in absolute values) of the canvas.
     * @param {Boolean} [params.clamp=true] Whether to clamp when panning such that there is always content visible.
     * @param {Boolean} [params.clampZoom=true] Whether to clamp when zooming such that there is always content visible.
     * @param {Boolean} [params.clampToBackground=false] Whether or not to clamp to the background image. This flag means the widget will always ensure at least some of the background is visible. See `clampToBackgroundExtents` for a variant of this.
     * @param {Boolean} [params.clampToBackgroundExtents=false] Clamps movement so that when zoomed out, the background image always fills the viewport.
     * @param {Function} [params.onBackgroundReady] Optional callback to hit when the background image has loaded.
     * @param {Number} [params.panDistance=50] How far, in pixels, to pan on pan nudge.
     * @param {Number} [params.zoom=1] Initial zoom for the widget.
     * @param {Number[]} [params.zoomRange=[0.05, 3] ] Zoom range for the widget.
     * @param {Boolean} [params.enableWheelZoom=true] Whether or not wheel zoom is enabled.
     * @param {Function} [params.wheelFilter] Optional function to call to check if wheel zooming should be enabled for the current event target.
     * @param {Boolean} [params.enablePan=true] Whether or not pan is enabled.
     * @param {Boolean} [params.enablePanButtons=true] Whether or not wheel pan buttons are drawn and enabled.
     * @param {Boolean} [params.enableAnimation=true] Enable animations for panning. Defaults to true.
     * @param {Boolean} [params.enabled=true] Whether or not the widget is enabled, ie. responding to mouse input.
     * @param {Object} [params.background] Optional background image parameters
     * @param {String} [params.background.url] URL for the background. Required for both single images and tiled backgrounds.
     * @param {String} [params.background.type="simple"] "simple" or "tiled" - the type of background.
     * @param {Number[]} [params.background.tileSize] For tiled backgrounds, provides the width and height of tiles. Every tile is assumed to have these dimensions, even if the tile has whitespace in it.
     * @param {Number} [params.background.width] Required for tiled backgrounds. Indicates the width of the full image.
     * @param {Number} [params.background.height] Required for tiled backgrounds. Indicates the height of the full image.
     * @param {Number} [params.background.maxZoom] Required for tiled backgrounds. Indicates the maximum zoom level. Zoom starts at 0 - fully zoomed out - and increases in integer values from there. Eash successive zoom level is twice the zoom of the previous level, meaning two times as many tiles in each direction.
     * @param {Function} [params.filter] Optional filter that will be called on down event, with the event target and the event. Returning true from this function means the widget should respond to the event.
     * @param {Number[]} [params.padding] Optional values for padding in the x/y axes to leave around the content. This is only of any use if you have disabled panning via mouse drag,
     * since in that case the user sees only scroll bars and has no way of navigating beyond the content. Some padding makes the UI nicer to use. Default is [0,0].
     * @param {Boolean} [params.consumeRightClick=true] Useful for development: set this to false if you don't want the widget to consume context menu clicks.
     * @param {Boolean} [params.smartMinimumZoom=false] Means that the lower zoom bound refers to a multiple of the content bounds, not the viewport.
     */
    this.ZoomWidget = function (params) {

        params.events = params.events || {};

        var self = this,
            devNull = function () { },
            canvas = params.canvas,
            domElement = params.domElement || function (e) {
                return e;
            },
            canvasElement = domElement(canvas),
            viewport = params.viewport,
            viewportElement = domElement(viewport),
            onZoom = params.events.zoom || devNull,
            onMaybeZoom = params.events.maybeZoom || function () {
                return true;
            },
            onPan = params.events.pan || devNull,
            onMouseDown = params.events.mousedown || devNull,
            onMouseUp = params.events.mouseup || devNull,
            onMouseMove = params.events.mousemove || devNull,
            onSetTransformOrigin = params.events.transformOrigin || devNull,
            clamp = !(params.clamp === false),
            clampZoom = params.clampZoom !== false,
            panDistance = params.panDistance || 50,
            enablePan = params.enablePan !== false,
            enableWheelZoom = params.enableWheelZoom !== false,
            enableAnimation = params.enableAnimation !== false,
            wheelFilter = params.wheelFilter || function () {
                return true;
            },
            wheelSensitivity = params.wheelSensitivity || 10,
            enablePanButtons = params.enablePanButtons !== false,
            padding = params.padding || [0, 0],
            consumeRightClick = params.consumeRightClick !== false,
            smartMinimumZoom = params.smartMinimumZoom,
            _renderingSuspended = false,
            downEvent = "mousedown",
            upEvent = "mouseup",
            moveEvent = "mousemove",
            transformPrefixes = [ "webkit", "Moz", "ms"],
            bind = params.bind,
            unbind = params.unbind,
            enabled = !(params.enabled === false),
            clampToBackground = params.clampToBackground,
            clampToBackgroundExtents = params.clampToBackgroundExtents,
            filter = params.filter || function (_) {
                return false;
            },
            widthFn = params.width,
            heightFn = params.height,
            backgroundLayer;

// ------------------------  these are the variables required to keep track of the pan/zoom state -----------
        var left = 0,
            top = 0,
            zoom = params.zoom || 1,    // the current zoom level
            transformOrigin = [ 0, 0 ],	// current transform origin values (as percentages)
            panning = false, 			// whether or not we are currently panning
            pinchZooming = false,// whether or not we are currently pinch zooming
            zooming = false,			// whether or not we are currently zooming with right-click mouse
            zoomingWithWheel = false,   // whether or not we are currently mouse wheel zooming
            downAt,                         // the pagex/pagey of either a mousedown or single touchstart, or the center point of a 2 touch touchstart
            zoomRange = params.zoomRange || [0.05, 3],		// allowed range of zoom.
            zoomAtZoomStart,            // the zoom level when zooming began
            maximumZoomTravel = 150,    // the maximum distance in Y that a right-click and drag
        // zoom will respond to. this effectively sets the
        // sensitivity of zooming in that way
            distanceAtZoomStart,        // the distance between touches when zooming began
            lastDistance,
            canvasAtPanStart,           // the location of the canvas when zooming or panning starts.
            lastMouseX = -1,            // last x pos from a mouse move (reset to -1 on mousedown)
            lastMouseY = -1;            // last y pos from a mouse move (reset to -1 on mousedown)


// ------------------------ these are the variables/functions used to keep track of the content bounds --------------------

        var _canvasBounds = { // bounds of the content
                minx: [],
                maxx: [],
                miny: [],
                maxy: []
            },
            _elementPositions = {},
            _nodeMap = {},
            _sortDirtyFlag = false,
            _sortBounds = function () {
                _canvasBounds.minx.sort(function (a, b) {
                    return a[0][0] < b[0][0] ? -1 : 1;
                });
                _canvasBounds.miny.sort(function (a, b) {
                    return a[0][1] < b[0][1] ? -1 : 1;
                });
                _canvasBounds.maxx.sort(function (a, b) {
                    return a[0][0] + a[1] > b[0][0] + b[1] ? -1 : 1;
                });
                _canvasBounds.maxy.sort(function (a, b) {
                    return a[0][1] + a[2] > b[0][1] + b[2] ? -1 : 1;
                });
            },
            _updateBounds = function (id, pos, w, h) {
                if (_elementPositions[id] == null) {
                    _elementPositions[id] = [];
                    _canvasBounds.minx.push(_elementPositions[id]);
                    _canvasBounds.miny.push(_elementPositions[id]);
                    _canvasBounds.maxx.push(_elementPositions[id]);
                    _canvasBounds.maxy.push(_elementPositions[id]);
                }
                _elementPositions[id][0] = pos;
                _elementPositions[id][1] = w;
                _elementPositions[id][2] = h;
                _elementPositions[id][3] = id;

                if (!_renderingSuspended)
                    _sortBounds();
                else
                    _sortDirtyFlag = true;
            },
            _debugBounds = function () {
                console.log("minx:", _canvasBounds.minx[0][0][0], _canvasBounds.minx[0][3], "maxx:", _canvasBounds.maxx[0][0][0], _canvasBounds.maxx[0][3], "miny:", _canvasBounds.miny[0][0][1], _canvasBounds.miny[0][3], "maxy:", _canvasBounds.maxy[0][0][1], _canvasBounds.maxy[0][3]);
            };

        /**
         * Sets whether or not rendering is suspended, which for the moment means that when updateBounds is
         * called, the widget doesn't sort the bounds, since we know there will be more changes to the
         * positions and/or sizes of elements.
         * @param val True to suspend rendering, false to re-enable rendering. If an update was called during the
         * time that rendering was suspended, the positions are sorted once rendering is re-enabled.
         */
        this.setSuspendRendering = function (val) {
            _renderingSuspended = val;
            if (!val && _sortDirtyFlag) _sortBounds();
            _sortDirtyFlag = false;
        };

// ----------------------------- pan buttons ---------------------------------------------------------------

        var curryPanButton = function (dx, dy) {
                return function (e) {
                    _posDelta(canvasElement, dx * panDistance, dy * panDistance, null, true, function (m) {
                        onPan(m[0], m[1], zoom, zoom, e);
                        backgroundLayer && backgroundLayer.pan();
                        fixedLayer.pan();
                    });
                };
            },
            startPanTimeout = 150, // milliseconds
            panRepeatInterval = 60, // milliseconds
            panRepeatDistance = 10,
            _startTimer = null, _repeatTimer = null, currentPanButton = null,
            startPanTimer = function (dx, dy, btn) {
                return function () {
                    currentPanButton = btn;
                    params.addClass(currentPanButton, "jtk-surface-pan-active");
                    params.bind(document, "mouseup", clearPanTimer);
                    _startTimer = window.setTimeout(function () {
                        params.bind(document, upEvent, endPanRepeat);
                        _repeatTimer = window.setInterval(panRepeat(dx, dy), panRepeatInterval);
                    }, startPanTimeout);
                };
            },
            clearPanTimer = function () {
                window.clearTimeout(_startTimer);
                if (currentPanButton) {
                    params.removeClass(currentPanButton, "jtk-surface-pan-active");
                }
                currentPanButton = null;
            },
            panRepeat = function (dx, dy) {
                return function (e) {
                    var m = _posDelta(canvasElement, dx * panRepeatDistance, dy * panRepeatDistance, null);
                    onPan(m[0], m[1], zoom, zoom, e);
                    backgroundLayer && backgroundLayer.pan();
                    fixedLayer.pan();
                };
            },
            endPanRepeat = function () {
                window.clearTimeout(_repeatTimer);
            },
            makePanButton = function (face, props, dx, dy, content) {
                var d = document.createElement("div");
                d.innerHTML = content || "";
                d.style.position = "absolute";
                for (var i in props)
                    d.style[i] = props[i];

                d.className = "jtk-surface-pan jtk-surface-pan-" + face;
                viewportElement.appendChild(d);
                params.bind(d, "click", curryPanButton(dx, dy));
                params.bind(d, "mousedown", startPanTimer(dx, dy, d));
                return d;
            };

        if (enablePanButtons) {
            makePanButton("top", {left: "0px", top: "0px"}, 0, -1, "&#8593;");
            makePanButton("bottom", {left: "0px", bottom: "0px" }, 0, 1, "&#8595;");
            makePanButton("left", {left: "0px", top: "0px" }, -1, 0, "&#8592;");
            makePanButton("right", {right: "0px", top: "0px" }, 1, 0, "&#8594;");
        }

// ----------------------------- /pan buttons --------------------------------------------------------------

        //
        // applies a transform property, by writing the property itself and also all of the
        // vendor-prefixed versions
        //
        var _applyTransformProperty = function (property, value, el) {
            el = el || canvasElement;
            for (var i = 0; i < transformPrefixes.length; i++) {
                var prefixedProp = property.replace(/([a-z]){1}/, function (a) {
                    return transformPrefixes[i] + a.toUpperCase();
                });
                el.style[prefixedProp] = value;
            }
            el.style[property] = value;
        };

        //
        // writes the current transform origin into the canvas' style.
        //
        var _writeTransformOrigin = function (el) {
            _applyTransformProperty("transformOrigin", transformOrigin[0] + "% " + transformOrigin[1] + "%", el);
        };

        //  document.
        var _originHelper = function (x, y) {
            var ap = _apparentOffset(),
                vo = params.offset(viewportElement, true),
                p = _pos(canvasElement),
                w = params.width(canvas),
                h = params.height(canvas),
                xy = [
                        ((x - (vo.left + p[0])) - ap[0]) / zoom,
                        ((y - (vo.top + p[1])) - ap[1]) / zoom
                ];
            return {
                w: w, h: h, xy: xy,
                xScale: xy[0] / w,
                yScale: xy[1] / h,
                o: [
                    xy[0] / w * 100,
                    xy[1] / h * 100
                ]
            };
        };

        var _setTransformHelper = function(xy, w, h, e) {
            var dx1, dy1, dx2, dy2,
                xloc = transformOrigin[0] / 100 * w,
                yloc = transformOrigin[1] / 100 * h;

            // first, store the location of the canvas top/left corner
            dx1 = -(xloc * (1 - zoom));
            dy1 = -(yloc * (1 - zoom));
            // now set the new transform origin
            transformOrigin = xy;
            // and write it to the element
            _writeTransformOrigin();
            xloc = transformOrigin[0] / 100 * w;
            yloc = transformOrigin[1] / 100 * h;
            // now get the new location of the canvas top/left corner
            dx2 = -(xloc * (1 - zoom));
            dy2 = -(yloc * (1 - zoom));
            // and then adjust the canvas to account for the shift caused by changing the transform origin.
            var newPos = _posDelta(canvasElement, dx2 - dx1, dy2 - dy1, e);

            onSetTransformOrigin && onSetTransformOrigin(transformOrigin, newPos);
        };

        //
        // sets the canvas's transform-origin to the given x,y, which is a page location.
        //
        //
        var _setTransformOriginToPoint = function (x, y, e) {
            var d = _originHelper(x, y);
            _setTransformHelper(d.o, d.w, d.h, e);
        };

        //
        // changes the transformOrigin of the canvas to be the point on the canvas at which the
        // given event occurred, then shifts the canvas to account for this change (the user sees
        // no shift)
        //
        var _setTransformOriginToEvent = function (e) {
            var pl = _pageLocation(e);
            _setTransformOriginToPoint(pl[0], pl[1], e);
        };

        //
        // changes the transformOrigin of the canvas to be the given x,y, which is a point on the canvas.
        //
        var _setTransformOriginToCanvasPoint = function(x, y) {
            var w = params.width(canvas), h = params.height(canvas);
            _setTransformHelper([ x / w * 100, y / h * 100 ], w, h);
        };

        /**
         * Decodes the page location from the given event, taking touch devices into account.
         * @method pageLocation
         * @return {Integer[]} [left, top] of the given event.
         */
        var _pageLocation = this.pageLocation = function (e) {
            if (e.pageX)
                return [e.pageX, e.pageY];
            else {
                var t = _getTouch(_touches(e), 0);
                if (t)
                    return [ t.pageX, t.pageY ];
                else
                    return [0, 0];
            }
        };

        //
        // extracts the touch with the given index from the list of touches
        //
        var _getTouch = function (touches, idx) {
            return touches.item ? touches.item(idx) : touches[idx];
        };

        //
        // gets the touches from the given event, if they exist.
        //
        var _touches = function (e) {
            return e.touches || [];
        };

        //
        // sets the current zoom and adjusts the canvas appropriately.
        //
        var _zoom = function (z, e, wheel, animate, dontFireEvent) {
            if (z == null || isNaN(z) || z < 0) return;
            var minZoom = zoomRange[0];

            // clamp to range. smartMinimumZoom means that the lower zoom range refers to a proportion of
            // content bounds, not of the viewport. So a value of 0.8 would mean that the furthest we
            // would zoom out would be to the point that the visible content is 1.25 (1 / 0.8) times
            // smaller than the viewport.  DISABLED.
            if (false || smartMinimumZoom) {
                minZoom = 0.5;
                var smz = getBoundsInfo().z,
                    zoomToContentRatio = z / smz;

                if (zoomToContentRatio < minZoom)
                    z = smz * minZoom;
            }
            else {
                // standard behaviour is just that the minimum refers to a multiple of the viewport size.
                if (z < minZoom) z = minZoom;
            }

            // test maximum.
            if (z > zoomRange[1]) z = zoomRange[1];

            // the zoom operation can be overridden. miniview uses this to detect a change in zoom
            // and change its related surface instead of zooming itself.

            if (animate) {
                // if animate was set, we just want to fire several zoom calls here to get us from the
                // current zoom to the target zoom, and then exit this method.
                var step = z > zoom ? 0.05 : -0.05, cur = zoom, down = z < zoom;
                var ticktock = window.setInterval(function() {
                    cur = _zoom(cur + step);
                    if (down && cur <= z) window.clearInterval(ticktock);
                    if (!down && cur >= z) window.clearInterval(ticktock);
                });
                return zoom;
            }

            _applyTransformProperty("transform", "scale(" + z + ")");
            var oldZoom = zoom;
            zoom = z;
            if (!dontFireEvent)
                onZoom(left, top, zoom, oldZoom, e, wheel);

            // update tile layer
            if (backgroundLayer != null) {
                backgroundLayer.setZoom(z);
            }

            fixedLayer && fixedLayer.pan();

            // clamp the display
            if (clampZoom) {
                var elPos = _pos(canvasElement);
                var cPos = _clamp(elPos[0], elPos[1]);
                if (cPos[0] != elPos[0] || cPos[1] != elPos[1])
                    _pos(canvasElement, cPos[0], cPos[1], null, !animate);
            }

            return zoom;
        };

        //
        // used for right-click zooming.  It takes the amount
        // of travel in the y direction, clamps it to some maximum, and then uses zoomWithMappedRange
        // to translate that into a new zoom value.
        //
        var _zoomBy = function (dx, dy, e, wheel) {
            if (dy < (-maximumZoomTravel)) dy = (-maximumZoomTravel);
            if (dy > maximumZoomTravel) dy = maximumZoomTravel;
            _zoomWithMappedRange(zoomAtZoomStart, dy, (-maximumZoomTravel), maximumZoomTravel, e, wheel);
        };

        //
        // sets zoom the some value with the current range, by calculating where in the range
        // the given 'value' sits.
        //
        var _zoomWithMappedRange = function (startZoom, value, low, high, e, wheel) {
            var p = value / ((value >= 0) ? high : low),
                idx = value >= 0 ? 1 : 0,
                z = startZoom + (p * (zoomRange[idx] - startZoom));

            _zoom(z, e, wheel);
        };

        //
        // takes a desired x,y for the canvas origin and clamps the values such that at least
        // one managed element is visible. you can suppress this behaviour by setting
        // clamp:false in the constructor, or calling setClamp(false) on the widget.
        //
        var _clamp = function (x, y, padding) {
            if (!clamp && !clampToBackground && !clampToBackgroundExtents) return [ x, y ];
            else {
                var ao = _apparentOffset(),
                    _x = x,
                    _y = y,
                    bi = clamp ? getBoundsInfo() : {
                        x: 0, y: 0, w: 0, h: 0,
                        vw: params.width(viewportElement),
                        vh: params.height(viewportElement),
                        padding: padding, z: 1
                    };

                padding = (padding || 20) * zoom;

                if ((clampToBackground || clampToBackgroundExtents) && backgroundLayer != null) {
                    var bw = backgroundLayer.getWidth(),
                        bh = backgroundLayer.getHeight(),
                        xmax = Math.max(bi.x + bi.w, bw),
                        ymax = Math.max(bi.y + bi.h, bh);

                    bi.w = xmax - bi.w;
                    bi.h = ymax - bi.h;

                    var zx = bi.vw / bi.w,
                        zy = bi.vh / bi.h;

                    bi.z = Math.min(zx, zy);

                    // adjust padding so that the background image never leaves the corners
                    if (clampToBackgroundExtents)
                        padding = (Math.max(bi.vw, bi.vh));
                }

                var boundsMax = [ bi.x + bi.w, bi.y + bi.h ];
                if (backgroundLayer) {
                    boundsMax[0] = Math.max(boundsMax[0], backgroundLayer.getWidth());
                    boundsMax[1] = Math.max(boundsMax[1], backgroundLayer.getHeight());
                }

                var dxmin = (x + ao[0]) + (boundsMax[0] * zoom) - padding,
                    dymin = (y + ao[1]) + (boundsMax[1] * zoom) - padding,
                    dxmax = (x + ao[0]) + (bi.x * zoom) + padding,
                    dymax = (y + ao[1]) + (bi.y * zoom) + padding;

                // x min
                if (dxmin < 0) _x -= dxmin;
                // x max
                if (dxmax > bi.vw) _x -= (dxmax - bi.vw);
                // y min
                if (dymin < 0) _y -= dymin;
                // x max
                if (dymax > bi.vh) _y -= (dymax - bi.vh);

                return [ _x, _y ];
            }
        };

        //
        // either gets an element position, or sets it, depending on how many arguments are given.
        // when setting the position, by default it will try to animate the transition. however you
        // can override that by setting doNotAnimate to true, or by not supplying an animate
        // function to the constructor.
        //
        var _pos = function (el, x, y, e, doNotAnimate, onComplete, onStep) {
            if (arguments.length == 1) {
                return [ parseInt(el.style.left, 10) || 0, parseInt(el.style.top, 10) || 0 ];
            }
            else {
                var c = _clamp(x, y);
                if (enableAnimation && !doNotAnimate && params.animate) {
                    params.animate(el, {
                        left: c[0],
                        top: c[1]
                    }, {
                        step: onStep,
                        complete: function () {
                            onComplete && onComplete(c);
                        }
                    });
                }
                else {
                    el.style.left = c[0] + "px";
                    el.style.top = c[1] + "px";
                    onComplete && onComplete(c);
                }

                return c;
            }
        };

        canvasElement.style.left = "0px";
        canvasElement.style.top = "0px";

        //
        // alters the position of the given element by dx,dy
        // return the distance that was allowed, after clamping.
        //
        var _posDelta = function (el, dx, dy, e, animate, onComplete) {
            var p = _pos(el);
            return _pos(el, p[0] + dx, p[1] + dy, e, !animate, onComplete);
        };

        //
        // gets the apparent offset of the canvas, taking zoom and transform origin
        // into account. This is relative to the [0,0] point of the canvas's parent, and when
        // zoom != 1 this will vary from what the DOM itself will tell you. For instance say you
        // have these conditions:
        // left/top : 50, 50
        // w/h      : 400, 400
        // zoom     : 0.5
        // origin   : 50% 50%
        //
        // the canvas appears to be 200,200 in size, in this case centered around 50% 50%. so the
        // apparent offset from the reported left/top will be 100,100.
        //
        // you can see from this maths that a transform origin of 0% 0% will return [0,0] from
        // this method.
        //
        var _apparentOffset = function () {
            var w = params.width(canvas),
                h = params.height(canvas),
                xloc = (transformOrigin[0] / 100) * w,
                yloc = (transformOrigin[1] / 100) * h;

            return [
                    xloc * ( 1 - zoom ),
                    yloc * ( 1 - zoom )
            ];
        };

        // event handlers. these are the core of the functionality.
        var handlers = {
            "start": function (e, touches) {
                if (pinchZooming) return;
                var target = e.srcElement || e.target;
                if (enabled && (target == canvasElement || target == viewportElement || target._jtkDecoration || (backgroundLayer && backgroundLayer.owns(target)) || filter(target, e) === true)) {
                    zoomingWithWheel = false;
                    lastMouseX = -1;
                    lastMouseY = -1;
                    if (e.which === 3 && params.enableWheelZoom !== false && (e.mozInputSource == null || e.mozInputSource === 1)) {
                        zooming = true;
                        downAt = _pageLocation(e);
                        _setTransformOriginToEvent(e);
                        canvasAtPanStart = _pos(canvasElement);
                        zoomAtZoomStart = zoom;
                    }
                    else if (touches.length <= 1) {
                        panning = true;
                        downAt = _pageLocation(e);
                        canvasAtPanStart = _pos(canvasElement);
                    }
                }
                onMouseDown(e, self);
            },
            "move": function (e, touches) {
                var dx, dy, pl;
                zoomingWithWheel = false;
                if (pinchZooming) return;
                if (zooming) {
                    pl = _pageLocation(e);
                    dx = pl[0] - downAt[0];
                    dy = pl[1] - downAt[1];
                    _zoomBy(dx, dy, e);
                }
                else if (panning && enablePan && downAt != null) {
                    pl = _pageLocation(e);
                    dx = pl[0] - downAt[0];
                    dy = pl[1] - downAt[1];

                    var clampedMovement = _pos(canvasElement, (canvasAtPanStart[0] + dx), (canvasAtPanStart[1] + dy), e, true);

                    onPan(clampedMovement[0], clampedMovement[1], zoom, zoom, e);
                    backgroundLayer && backgroundLayer.pan();
                    fixedLayer && fixedLayer.pan();
                }
                onMouseMove(e, self);
            },
            "end": function (e, touches) {
                if (pinchZooming) return;
                zooming = false;
                downAt = null;
                panning = false;
                zoomingWithWheel = false;
                unbind(document, moveEvent, _curriedMove);
                unbind(document, upEvent, _curriedEnd);
                bind(document, moveEvent, _moveReset);
                onMouseUp(e, self);
            },
            "contextmenu": function (e) {
            }
        };

        var _call = function (type, e) {
                if (type == "contextmenu" && consumeRightClick)
                    e.preventDefault && e.preventDefault();
                var t = _touches(e);
                handlers[type](e, t);
            },
            _curriedMove = function (e) {
                _call("move", e);
            },
            _curriedEnd = function (e) {
                _call("end", e);
            },
            _moveReset = function (e) {
                zoomingWithWheel = false;
            };

        // bind the moveReset function to move; it is unbound on downEvent and re-bound on up event
        bind(document, moveEvent, _moveReset);

        /**
         * Programmatically report a down event in order to kick the widget into action.
         * @method start
         * @param {Event} e Mouse event to use to kick things off.
         */
        var _start = this.start = function (e) {
            if (enabled && e != null) {
                unbind(document, moveEvent, _moveReset);
                bind(document, moveEvent, _curriedMove);
                bind(document, upEvent, _curriedEnd);
                handlers["start"](e, _touches(e));
            }
        };
        // bind start event. it is responsible for attaching move event and end event to the document
        bind(viewport, downEvent, _start);

        bind(viewport, "contextmenu", function (e) {
            _call("contextmenu", e);
        });

        if (enableWheelZoom) {
            var wheelZoom = function (e) {
                if (wheelFilter(e)) {
                    e.preventDefault && e.preventDefault();
                    e.stopPropagation && e.stopPropagation();

                    zoomAtZoomStart = zoom;
                    if (!zoomingWithWheel) {
                        _setTransformOriginToEvent(e);
                        zoomingWithWheel = true;
                    }
                    _zoomBy(0, e.normalizedWheelDelta * wheelSensitivity, e, true);
                }
            };
            // Firefox posts wheel events for a single touch moving on an element. we dont want that.
            // we want pinch to zoom.
            addWheelListener(viewportElement, wheelZoom, true);
        }

        // pinchlistsner
        new PinchListener({
            el:viewport,
            bind:bind,
            unbind:unbind,
            enableWheelZoom:params.enableWheelZoom,
            onPinch:function(center, startRadius, radius, ratio) {
                _zoom(ratio * zoomAtZoomStart);
                var dx = center[0] - downAt[0], dy = center[1] - downAt[1];
                _pos(canvasElement, canvasAtPanStart[0] + dx, canvasAtPanStart[1] + dy, null, true);
            },
            onPinchStart:function(center, startRadius) {
                pinchZooming = true;
                downAt = center;
                distanceAtZoomStart = lastDistance = startRadius;
                zoomAtZoomStart = zoom;
                _setTransformOriginToPoint(downAt[0], downAt[1]);
                canvasAtPanStart = _pos(canvasElement);
            },
            onPinchEnd:function() {
                pinchZooming = false;
                downAt = null;
            }
        });

        // force transform origin and scale
        _zoom(zoom, null, false, false, true);
        _writeTransformOrigin();

        function getBoundsInfo(padding) {

            if (isEmpty()) {
                return {
                    w: 0,
                    h: 0,
                    x: 0,
                    y: 0,
                    vw: params.width(viewportElement),
                    vh: params.height(viewportElement),
                    padding: padding,
                    z: 1,
                    zoom: 1
                };
            }

            padding = 0;
            var boundsW = Math.abs((_canvasBounds.maxx[0][0][0] + _canvasBounds.maxx[0][1]) - _canvasBounds.minx[0][0][0]),
                boundsH = Math.abs((_canvasBounds.maxy[0][0][1] + _canvasBounds.maxy[0][2]) - _canvasBounds.miny[0][0][1]),
                viewportW = params.width(viewportElement),
                viewportH = params.height(viewportElement),
                zx = viewportW / boundsW,
                zy = viewportH / boundsH,
                z = Math.min(zx, zy);

            return {
                w: boundsW,
                h: boundsH,
                x: _canvasBounds.minx[0][0][0],
                y: _canvasBounds.miny[0][0][1],
                vw: viewportW,
                vh: viewportH,
                padding: padding,
                z: z,
                zoom: zoom
            };
        }

        function isEmpty() {
            for (var i in _elementPositions)
                return false;
            return true;
        }

// -------------------------   public API -------------------------------------------------------


        /**
         * Registers that an element has changed position, updating bounds info as necessary.
         * @method positionChanged
         * @param {Element} el Element that has just moved.
         * @param {Number[]} [pos] New position. If this is omitted, it will be calculated.
         * @param {String} [id] Optional id of the element. This might be called from a context in which
         * the id is known already, so we can save some work.
         */
        this.positionChanged = function (el, pos, id) {
            id = id || params.id(el);
            var p = pos || _pos(el), w = params.width(el), h = params.height(el);
            _nodeMap[id] = el;
            _updateBounds(id, p, w, h);
        };

        /**
         * Adds the given element to those that this widget is tracking.
         * @method add
         * @param {Element} el Element to begin tracking.
         * @param {String} [id] Optional id of the element. This might be called from a context in which
         * the id is known already, so we can save some work.
         * @param {Number[]} [pos] Optional location for the node.  If not provided, the position will be retrieved from a call to the DOM.
         */
        this.add = function (el, id, pos, isDecoration) {
            this.positionChanged(el, pos, id);
            if (isDecoration) {
                bind(el, downEvent, _start);
                el._jtkDecoration = true;
            }
        };

        /**
         * Removes the given element from the list this widget is tracking. Note that this widget does
         * not remove the element from the DOM.
         * @method remove
         * @param {Selector|Element} el Element to stop tracking.
         */
        this.remove = function (el) {
            el = domElement(el);
            var id = params.id(el);

            delete _elementPositions[id];
            delete _nodeMap[id];
            for (var i in _canvasBounds) {
                if (_canvasBounds.hasOwnProperty(i)) {
                    var idx = -1;
                    for (var j = 0; j < _canvasBounds[i].length; j++) {
                        if (_canvasBounds[i][j][3] === id) {
                            idx = j;
                            break;
                        }
                    }
                    if (idx != -1) _canvasBounds[i].splice(idx, 1);
                }
            }
        };

        /**
         * Removes all tracked elements and resets the widget.
         * @method reset
         */
        this.reset = function () {
            _canvasBounds.minx.length = 0;
            _canvasBounds.miny.length = 0;
            _canvasBounds.maxx.length = 0;
            _canvasBounds.maxy.length = 0;
            _elementPositions = {};
            _nodeMap = {};
            _pos(canvasElement, 0, 0, null, true);
        };

        /**
         * Gets the current bounds information.
         * @method getBoundsInfo
         * @return {Object} An object with these fields:
         * w - width of the content
         * h - height of the content
         * x - minimum x value of all nodes in the content
         * y - minimum y value of all nodes in the content
         * vw - width of the viewport
         * vh - height of the viewport
         * padding - padding around the content (an array)
         * z - smallest zoom that could result in all the content being visible inside the viewport
         * zoom - current zoom
         */
        this.getBoundsInfo = getBoundsInfo;

        /**
         * Zooms the display so that all the tracked elements fit inside the viewport. This method will also,
         * by default, increase the zoom if necessary - meaning the default behaviour is to adjust the zoom so that
         * the content fills the viewport. You can suppress zoom increase by setting `doNotZoomIfVisible:true` on the
         * parameters to this method.
         * @method zoomToFit
         * @param {Number} [params.padding=20] Optional padding to leave around all elements.
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotAnimate=true] By default, the centering content step does not use animation. This is due to this method being used most often to initially setup a UI.
         * @param {Boolean} [params.doNotZoomIfVisible=false] If true, no action is taken if the content is currently all visible.
         * @param {Boolean} [params.doNotFirePanEvent=false] If true, a pan event will not be fired.
         */
        this.zoomToFit = function (params) {
            params = params || {};
            var bi = getBoundsInfo(params.padding);

            if (!(params.doNotZoomIfVisible && bi.z > zoom))
                _zoom(bi.z);

            self.centerContent({
                bounds: bi,
                doNotAnimate: params.doNotAnimate !== false,
                onComplete: params.onComplete,
                onStep: params.onStep,
                doNotFirePanEvent: params.doNotFirePanEvent
            });
        };


        /**
         * Zooms the display so that all the tracked elements fit inside the viewport, but does not make any adjustments
         * to zoom if all the elements are currently visible (it still does center the content though).
         * @method zoomToFitIfNecessary
         * @param {Number} [params.padding = 20] Optional padding to leave around all elements.
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotAnimate=true] By default, the centering content step does not use animation. This is due to this method being used most often to initially setup a UI.
         */
        this.zoomToFitIfNecessary = function (params) {
            var p = jsPlumb.extend(params || {});
            p.doNotZoomIfVisible = true;
            this.zoomToFit(p);
        };

        /**
         * Zooms the display so that all the given elements fit inside the viewport.
         * @method zoomToElements
         * @param zParams
         * @param zParams.elements {Element[]} List of DOM elements to zoom to.
         * @param [zParams.doNotZoomIfVisible=false] If true and the widget determines the entire selection is already
         * visible, the zoom will not be adjusted.
         */
        this.zoomToElements = function(zParams) {
            var bi = {
                x:Infinity, y:Infinity,
                xMax:-Infinity, yMax:-Infinity,
                z:1,
                vw:params.width(viewportElement),
                vh:params.height(viewportElement)
            };

            for (var i = 0; i < zParams.elements.length; i++) {
                var e = zParams.elements[i];
                var o = params.offset(e), w = params.width(e), h = params.height(e);
                bi.x = Math.min(bi.x, o.left);
                bi.y = Math.min(bi.y, o.top);
                bi.xMax = Math.max(bi.xMax, o.left + w);
                bi.yMax = Math.max(bi.yMax, o.top + h);
            }

            bi.w = bi.xMax - bi.x;
            bi.h = bi.yMax - bi.y;
            bi.z = Math.min(bi.vw / bi.w, bi.vh / bi.h);

            if (!(zParams.doNotZoomIfVisible && bi.z > zoom))
                _zoom(bi.z);

            self.centerContent({
                bounds: bi,
                doNotAnimate: zParams.doNotAnimate !== false,
                onComplete: zParams.onComplete,
                onStep: zParams.onStep,
                doNotFirePanEvent: zParams.doNotFirePanEvent
            });
        };

        /**
         * Zooms the display so that the background fits inside the viewport.
         * @method zoomToBackground
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotAnimate=false] If true, centering content will not use animation.
         */
        this.zoomToBackground = function (params) {
            params = params || {};
            if (backgroundLayer != null) {
                var boundsW = backgroundLayer.getWidth(),
                    boundsH = backgroundLayer.getHeight(),
                    viewportW = widthFn(viewportElement),
                    viewportH = heightFn(viewportElement),
                    zx = viewportW / boundsW,
                    zy = viewportH / boundsH,
                    z = Math.min(zx, zy),
                    bi = { w: boundsW, h: boundsH, x: 0, y: 0, vw: viewportW, vh: viewportH, padding: 0, z: z };

                _zoom(bi.z);
                self.centerContent({
                    bounds: bi,
                    doNotAnimate: params.doNotAnimate,
                    onComplete: params.onComplete,
                    onStep: params.onStep
                });
            }
        };

        /**
         * Sets (or clears) the filter that will be called if the widget needs to know whether to respond to an event that would
         * start a pan. By default, the widget responds to down events on the viewport or the canvas, but not on child nodes. You
         * can supply a function that the widget will call in the event that the down event did not occur on the viewport or the canvas;
         * returning true from this function will cause the pan to begin.
         * @method setFilter
         * @param {Function} filterFn Function to set as the filter; may be null if you wish to clear it. The function should return true if it wants to honour the down event on the given element.
         */
        this.setFilter = function (filterFn) {
            filter = filterFn || function (_) {
                return false;
            };
        };

        /**
         * Position the widget so the background is centered in the viewport, without changing the current zoom.
         * @method centerBackground
         */
        this.centerBackground = function () {
            if (backgroundLayer != null) {
                var bi = jsPlumb.extend({}, getBoundsInfo());
                bi.x = backgroundLayer.getWidth() / 2;
                bi.y = backgroundLayer.getHeight() / 2;
                bi.w = 1;
                bi.h = 1;

                self.centerContent({
                    bounds: bi,
                    doNotAnimate: params.doNotAnimate,
                    onComplete: params.onComplete,
                    onStep: params.onStep,
                    vertical: true,
                    horizontal: true
                });
            }
        };

        /**
         * Positions the widget so that the edges of the background align with the viewport. This method is useful for
         * snapping to a corner of the background.
         * @method alignBackground
         * @param {String} [axes] Spec for the axes to align to. This should be a space-separated string containing a value
         * for the x (allowed values `left` and `right`) and, optionally, y (allowed values `top` and `bottom`) axes. The
         * default value is `"left top"`.
         */
        this.alignBackground = function (axes) {
            if (backgroundLayer != null) {
                var a = axes || "left top",
                    aa = axes.split(" "),
                    ax = aa[0] || "left",
                    ay = aa[1] || "top",
                    bi = getBoundsInfo(),
                    l = ax === "left" ? 0 : bi.vw - (backgroundLayer.getWidth() * zoom),
                    t = ay === "top" ? 0 : bi.vh - (backgroundLayer.getHeight() * zoom),
                    ap = _apparentOffset();

                _pos(canvasElement, l - ap[0], t - ap[1]);
                backgroundLayer.pan();
                fixedLayer && fixedLayer.pan();
            }
        };

        /**
         * Places (using `style.left` and `style.top`) the given element at the given x,y, which is taken to
         * mean an x,y value on the canvas.  At zoom 1, with no panning, this will be the same as the given x,y value
         * relative to the viewport origin.  But once the canvas has been zoomed and panned we have to map
         * to the altered coordinates. This function also takes into account the difference between the offset of the
         * viewport in the page and the offset of the given element. It is assumed, just because of what this method
         * does, that the given element will be positioned `absolute`, but this method does nothing to ensure that.
         * @method positionElementAt
         * @param {Selector|Element|String} el Element to position.
         * @param {Number} x X location on canvas to move element's left edge to.
         * @param {Number} y Y location on canvas to move element's top edge to.
         * @param {Number} [xShift=0] Optional absolute number of pixels to shift the element by in the x axis after calculating its position relative to the canvas. Typically you'd use this to place something other than the top left corner of your element at the desired location.
         * @param {Number} [yShift=0] Optional absolute number of pixels to shift the element by in the y axis after calculating its position relative to the canvas.
         * @param {Boolean} [ensureOnScreen=false] If true, will ensure that x and y positions are never negative.
         */
        this.positionElementAt = function (el, x, y, xShift, yShift, ensureOnScreen) {
            xShift = xShift || 0;
            yShift = yShift || 0;
            var ao = _apparentOffset(),
                cp = _pos(canvasElement),
                del = domElement(el),
                p = del.parentNode,
                po = params.offset(p),
                vo = params.offset(viewport),
                _x = (vo.left - po.left) + (cp[0] + ao[0]) + (x * zoom) + (xShift),
                _y = (vo.top - po.top) + (cp[1] + ao[1]) + (y * zoom) + (yShift);

            if (ensureOnScreen && _x < 0) _x = 0;
            if (ensureOnScreen && _y < 0) _y = 0;

            del.style.left = _x + "px";
            del.style.top = _y + "px";
        };

        /**
         * Places (using `style.left` and `style.top`) the given element at the given page x,y.  It is assumed, just because of what this method
         * does, that the given element will be positioned `absolute`, but this method does nothing to ensure that.
         * @method positionElementAt
         * @param {Selector|Element|String} el Element to position.
         * @param {Number} x X location on canvas to move element's left edge to.
         * @param {Number} y Y location on canvas to move element's top edge to.
         * @param {Number} [xShift=0] Optional absolute number of pixels to shift the element by in the x axis after calculating its position relative to the canvas. Typically you'd use this to place something other than the top left corner of your element at the desired location.
         * @param {Number} [yShift=0] Optional absolute number of pixels to shift the element by in the y axis after calculating its position relative to the canvas.
         */
        this.positionElementAtPageLocation = function (el, x, y, xShift, yShift) {
            var lt = this.mapLocation(x, y);
            this.positionElementAt(el, lt.left, lt.top, xShift, yShift);
        };

        /**
         * Places (using `style.left` and `style.top`) the given element at the page x,y corresponding to the given event.  It is assumed, just because of what this method
         * does, that the given element will be positioned `absolute`, but this method does nothing to ensure that.
         * @method positionElementAt
         * @param {Selector|Element|String} el Element to position.
         * @param {Event} evt Event to position element at.
         * @param {Number} [xShift=0] Optional absolute number of pixels to shift the element by in the x axis after calculating its position relative to the canvas. Typically you'd use this to place something other than the top left corner of your element at the desired location.
         * @param {Number} [yShift=0] Optional absolute number of pixels to shift the element by in the y axis after calculating its position relative to the canvas.
         */
        this.positionElementAtEventLocation = function (el, evt, xShift, yShift) {
            var lt = this.mapEventLocation(evt);
            this.positionElementAt(el, lt.left, lt.top, xShift, yShift);
        };

        /**
         * Zooms the component by the given increment, centered on the location at which the given event occurred.
         * @method zoomToEvent
         * @param {Event} e Browser event
         * @param {Number} increment Amount to zoom by (a positive or negative number). If this takes the component out of the current zoom range, it will be clamped.
         */
        this.zoomToEvent = function (e, increment) {
            _setTransformOriginToEvent(e);
            _zoom(zoom + increment, e);
        };

        /**
         * Tells the widget that a relayout has occurred. If panning is
         * disabled, the widget will move the canvas element so that all
         * content is visible, and adjust the transform origin so that the ui
         * zooms from the apparent top left corner.
         * @method relayout
         * @param {Object} boundsInfo Bounds information, in the same format as the `getBoundsInfo` method returns.
         * @param {Boolean} [doNotAnimate=false] If true, the widget will not animate the change.
         */
        this.relayout = function (boundsInfo, doNotAnimate) {
            if (params.enablePan === false) {
                _pos(canvasElement, -boundsInfo.x + padding[0], -boundsInfo.y + padding[1], null, doNotAnimate);
                // allow for padding - sizing the canvas will give the overflow we need
                var pw = boundsInfo.w + (boundsInfo.x < 0 ? boundsInfo.x : 0) + padding[0],
                    ph = boundsInfo.h + (boundsInfo.y < 0 ? boundsInfo.y : 0) + padding[1];
                canvasElement.style.width = pw + "px";
                canvasElement.style.height = ph + "px";
                var tox = pw == 0 ? 0 : (boundsInfo.x - padding[0]) / pw * 100,
                    toy = ph == 0 ? 0 : (boundsInfo.y - padding[1]) / ph * 100;
                // transformOrigin
                this.setTransformOrigin(tox, toy);
            }
        };

        /**
         * Nudges the zoom by the given amount. Zoom will be clamped to the current zoom range in effect and the
         * value that was ultimately set is returned from this function.
         * @method nudgeZoom
         * @param {Number} delta Amount to change zoom by. The value you pass in here is multiplied by
         * 100 to give a percentage value: 1 is 100%, for instance, 0.05 is 5%. You can pass in negative numbers to
         * zoom out.
         * @param {Event} [e] Original event that caused the nudge. May be null.
         * @return {Number} The zoom that was set. Zoom will be clamped to the allowed range.
         */
        this.nudgeZoom = function (delta, e) {

            // first set transform origin to be center of viewport
            var vo = params.offset(viewportElement, true),
                mx = vo.left + (params.width(viewportElement) / 2),
                my = vo.top + (params.height(viewportElement) / 2);

            _setTransformOriginToPoint(mx, my);

            return _zoom(zoom + delta, e);
        };

        /**
         * Nudges the wheel zoom by the given amount. This function is intended for use by components that control
         * zoom via the mouse wheel, and not for general usage. See `nudgeZoom` for a more general version of this.
         * @method nudgeWheelZoom
         * @param {Number} delta Amount to change zoom by.
         * @param {Event} [e] Original event that caused the nudge. May be null.
         */
        this.nudgeWheelZoom = function (delta, e) {
            zoomAtZoomStart = zoom;
            _zoomBy(0, delta, e, true);
        };

        /**
         * Centers the tracked content inside the viewport, but does not adjust the current zoom.
         * @method centerContent
         * @param {Object} params Method parameters.
         * @param {Object} [params.bounds] Bounds info. This is in an internal format and only used when this method is called by the widget itself. Otherwise it is calculated.
         * @param {Boolean} [params.doNotAnimate=false] If true, don't animate while centering.
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotFirePanEvent=false] If true, a pan event will not be fired.
         */
        this.centerContent = function (params) {
            params = params || {};
            var bi = params.bounds || getBoundsInfo();
            var ao = _apparentOffset(),
                midBoundsX = (bi.x * zoom) + (bi.w * zoom / 2),
                midBoundsY = (bi.y * zoom) + (bi.h * zoom / 2),
                l = (bi.vw / 2) - midBoundsX,
                t = (bi.vh / 2) - midBoundsY,
                cp = _pos(canvasElement);

            _pos(canvasElement,
                    params.horizontal !== false ? l - ao[0] : cp[0],
                    params.vertical !== false ? t - ao[1] : cp[1],
                null,
                params.doNotAnimate,
                function() {
                    if (!params.doNotFirePanEvent)
                        onPan(params.horizontal !== false ? l - cp[0] : 0, params.vertical !== false ? t - cp[1] : 0, zoom, zoom);

                    backgroundLayer && backgroundLayer.pan();
                    fixedLayer && fixedLayer.pan();

                    if (params.onComplete) params.onComplete();
                },
                params.onStep
            );
        };

        /**
         * Centers the tracked content inside the viewport horizontally, but does not adjust the current zoom.
         * @method centerContentHorizontally
         * @param {Object} params Method parameters.
         * @param {Object} [params.bounds] Bounds info. This is in an internal format and only used when this method is called by the widget itself. Otherwise it is calculated.
         * @param {Boolean} [params.doNotAnimate=false] If true, don't animate while centering.
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotFirePanEvent=false] If true, a pan event will not be fired.
         */
        this.centerContentHorizontally = function (params) {
            this.centerContent(jsPlumb.extend({horizontal:true}, params));
        };

        /**
         * Centers the tracked content inside the viewport vertically, but does not adjust the current zoom.
         * @method centerContentVertically
         * @param {Object} params Method parameters.
         * @param {Object} [params.bounds] Bounds info. This is in an internal format and only used when this method is called by the widget itself. Otherwise it is calculated.
         * @param {Boolean} [params.doNotAnimate=false] If true, don't animate while centering.
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotFirePanEvent=false] If true, a pan event will not be fired.
         */
        this.centerContentVertically = function (params) {
            this.centerContent(jsPlumb.extend({vertical:true}, params));
        };

        /**
         * Centers the given element in the viewport, vertically and/or horizontally.
         * @method centerOn
         * @param {Element|String} element Element, or element id, to center.
         * @param {Object} [params] Optional extra parameters.
         * @param {Boolean} [params.horizontal=true] Whether or not to center horizontally
         * @param {Boolean} [params.vertical=true] Whether or not to center vertically
         * @param {Boolean} [params.doNotAnimate=false] If true, animation will not be switched on for the operation.
         * @param {Boolean} [params.onComplete] Optional on complete callback
         * @param {Boolean} [params.onStep] Optional on animation step callback.
         * @param {Number} [params.fillRatio=0.4]
         */
        this.centerOn = function (element, cparams) {
            cparams = cparams || {};
            var bi = jsPlumb.extend({}, getBoundsInfo()),
                p = _pos(element),
                w = widthFn(element),
                h = heightFn(element),
                self = this;

            bi.x = p[0];
            bi.y = p[1];
            bi.w = w;
            bi.h = h;

            var onComplete = function() {
                _setTransformOriginToCanvasPoint(p[0] + (w/2), p[1] + (h/2));
                cparams.onComplete && cparams.onComplete();
            };

            this.centerContent({
                bounds: bi,
                doNotAnimate: cparams.doNotAnimate,
                onComplete: onComplete,
                onStep: cparams.onStep,
                vertical: cparams.vertical !== false,
                horizontal: cparams.horizontal !== false
            });
        };

        /**
         * Centers the given element in the viewport, horizontally only.
         * @method centerOnHorizontally
         * @param {Element|String} element Element, or element id, to center.
         */
        this.centerOnHorizontally = function (element) {
            this.centerOn(element, { vertical:false });
        };

        /**
         * Centers the given element in the viewport, vertically only.
         * @method centerOnHorizontally
         * @param {Element|String} element Element, or element id, to center.
         */
        this.centerOnVertically = function (element) {
            this.centerOn(element, { horizontal: false });
        };

        /**
         * Centers on the given element and then adjusts the zoom of the widget so that the short axis of the viewport
         * is [1 / fillRatio] larger than its corresponding axis on the centered node. `fillRatio` is basically
         * a measure of how much context you want to see around the node on which you centered.
         * @method centerOnAndZoom
         * @param {Element|String} element Element, or element id, to center.
         * @param {Number} [fillRatio=0.6] Proportional ratio of the corresponding node's edge to the viewport's short edge.
         */
        this.centerOnAndZoom = function (element, fillRatio) {
            fillRatio = fillRatio || 0.6;
            var dim = { w : widthFn(element), h : heightFn(element) },
                p = _pos(element),
                bi = getBoundsInfo(),
                shortAxis = bi.vw < bi.vh ? [bi.vw, "w"] : [bi.vh, "h"],
                shortAxisApparentLength = fillRatio * shortAxis[0],
                desiredZoom = shortAxisApparentLength / dim[shortAxis[1]];

            if (desiredZoom < zoomRange[0]) desiredZoom = zoomRange[0];
            if (desiredZoom > zoomRange[1]) desiredZoom = zoomRange[1];

            var curZoom = zoom, zoomDelta = desiredZoom - zoom;

            _setTransformOriginToCanvasPoint(p[0] + (dim.w/2), p[1] + (dim.h/2));

            this.centerOn(element, {
                onStep:function(step, steps) {
                    _zoom(curZoom + (step / steps * zoomDelta));
                },
                onComplete:function() {
                    _zoom(desiredZoom);
                }
            });
        };

        /**
         * Gets the canvas location that corresponds to the center of the viewport.  Note that this may describe
         * a point outside of the content bounds.
         * @method getViewportCenter
         * @return {Number[]} left,top location of the logical position on the canvas corresponding to the center of the viewport.
         */
        this.getViewportCenter = function () {
            var bi = jsPlumb.extend({}, getBoundsInfo()),
                ao = _apparentOffset(),
                cp = _pos(canvasElement),
                p = [ bi.vw / 2, bi.vh / 2 ];

            return [
                    (p[0] - (cp[0] + ao[0])) / zoom,
                    (p[1] - (cp[1] + ao[1])) / zoom
            ];
        };

        /**
         * Sets the location of the canvas such that the given point appears at the center of the viewport.
         * @method setViewportCenter
         * @param {Number[]} xy left, top location of the point on the canvas to position in the center of the viewport.
         */
        this.setViewportCenter = function (xy) {
            var bi = jsPlumb.extend({}, getBoundsInfo()),
                ao = _apparentOffset(),
                p = [ bi.vw / 2, bi.vh / 2 ];

            var _ = [
                ao[0] + (( zoom * xy[0] ) + p[0] ),
                ao[1] + (( zoom * xy[1] ) + p[1] )
            ];

            _pos(canvasElement, _[0], _[1]);
        };

        /**
         * Sets whether or not the widget clamps the movement of the canvas during pan/zoom
         * to ensure that the managed content never disappears from view.
         * @method setClamping
         * @param {Boolean} clamp Whether or not to clamp movement.
         */
        this.setClamping = function (c) {
            clamp = c;
        };

        /**
         * Sets the current zoom, clamping it to the allowed range.
         * @method setZoom
         * @param {Number} z Zoom value. If this is outside the allowed bounds it will be clamped.
         * @param {Boolean} [dontFireEvent=false] If true, a zoom event will not be fired.
         * @return {Number} Current zoom. This may or may not be the value you asked for - it might have been clamped to the current allowed zoom range.
         */
        this.setZoom = function (z, animate, dontFireEvent) {
            return _zoom(z, null, null, animate, dontFireEvent);
        };

        /**
         * Sets the current zoom range. By default, this method checks if the current zoom is within
         * the new range, and if it is not then `setZoom` is called, which will cause the zoom to be clamped
         * to an allowed value in the new range. You can disable this by passing `true` for `doNotClamp`.
         *
         * @method setZoomRange
         * @param {Number[]} zr New range, as an array consisting of [lower, upper] values. Lower must be less than upper.
         * @param {Boolean} [doNotClamp] If true, will not check the current zoom to ensure it falls within the new range.
         */
        this.setZoomRange = function (zr, doNotClamp) {
            if (zr != null && zr.length == 2 && zr[0] < zr[1] && zr[0] != null && zr[1] != null && zr[0] > 0 && zr[1] > 0) {
                zoomRange = zr;
                if (!doNotClamp) {
                    if (zoom < zoomRange[0] || zoom > zoomRange[1])
                        _zoom(zoom);
                }
            }
            return this;
        };

        /**
         * Gets the current zoom range.
         * @method getZoomRange
         * @return {Number[]} Array of [min, max] zoom values.
         */
        this.getZoomRange = function () {
            return zoomRange;
        };

        /**
         * Gets the current zoom.
         * @method getZoom
         * @return {Number} Current zoom value
         */
        this.getZoom = function () {
            return zoom;
        };

        /**
         * Gets the current [left,top] of the panned content.
         * @method getPan
         * @return {Number[]} [left,top], in pixels, of the panned content, where [0,0] is the origin of the viewport.
         */
        this.getPan = function () {
            return _pos(canvasElement);
        };

        /**
         * Pans the content by dx and dy.
         * @method pan
         * @param {Number} dx Amount to pan in X direction
         * @param {Number} dy Amount to pan in Y direction
         * @param {Boolean} [animate = false] Whether or not to animate the pan.
         */
        this.pan = function (dx, dy, animate) {
            _posDelta(canvasElement, dx, dy, null, animate, function (m) {
                onPan(m[0], m[1], zoom, zoom);
                backgroundLayer && backgroundLayer.pan();
                fixedLayer && fixedLayer.pan();
            });
        };

        /**
         * Sets the position of the panned content's origin.
         * @method setPan
         * @param {Number} left Position in pixels of the left edge of the panned content.
         * @param {Number} top Position in pixels of the top edge of the panned content.
         * @param {Boolean} [animate = false] Whether or not to animate the pan.
         * @param {Function} [onComplete] If `animate` is set to true, an optional callback for the end of the pan.
         * @param {Function} [onStep] If `animate` is set to true, an optional callback for each frame in the pan.
         */
        this.setPan = function (left, top, animate, onComplete, onStep) {
            return _pos(canvasElement, left, top, null, !animate, onComplete, onStep);
        };

        /**
         * Sets the current transform origin, in pixels. Used mainly to support save/restore state.
         * @method setTransformOrigin
         * @param {Number} left Position of the X coordinate of the transform origin.
         * @param {Number} top Position of the Y coordinate of the transform origin.
         */

        this.setTransformOrigin = function (left, top) {
            transformOrigin = [left, top];
            _writeTransformOrigin();
        };

        /**
         * Maps the given page location to a value relative to the viewport origin, allowing for
         * zoom and pan of the canvas. This takes into account the offset of the viewport in the page so that what
         * you get back is the mapped position relative to the target element's [left,top] corner. If
         * you wish, you can supply true for 'doNotAdjustForOffset', to suppress that behavior.
         * @method mapLocation
         * @param {Number} left X location
         * @param {Number} top Y location
         * @param {Boolean} [doNotAdjustForOffset=false] Whether or not to adjust for the offset of the viewport in the page.
         */
        this.mapLocation = function (left, top, doNotAdjustForOffset) {
            var ao = _apparentOffset(),
                cp = _pos(canvasElement),
                sl = viewportElement.scrollLeft,
                st = viewportElement.scrollTop,
                viewportOffset = doNotAdjustForOffset ? { left: 0, top: 0 } : params.offset(viewportElement);

            return {
                left: (left - (cp[0] + ao[0]) - viewportOffset.left + sl) / zoom,
                top: (top - (cp[1] + ao[1]) - viewportOffset.top + st) / zoom
            };
        };


        /**
         * Maps the page location of the given event to a value relative to the viewport origin, allowing for
         * zoom and pan of the canvas. This takes into account the offset of the viewport in the page so that what
         * you get back is the mapped position relative to the target element's [left,top] corner. If
         * you wish, you can supply true for 'doNotAdjustForOffset', to suppress that behavior.
         * @method mapEventLocation
         * @param {Event} event Browser event
         * @param {Boolean} [doNotAdjustForOffset=false] Whether or not to adjust for the offset of the viewport in the page.
         */
        this.mapEventLocation = function (event, doNotAdjustForOffset) {
            var pl = _pageLocation(event);
            return this.mapLocation(pl[0], pl[1], doNotAdjustForOffset)
        };

        /**
         * Sets whether or not the component should respond to mouse events.
         * @method setEnabled
         * @param {Boolean} state Whether or not to respond to mouse events.
         */
        this.setEnabled = function (state) {
            enabled = state;
        };

        /**
         * Takes some element that is in the DOM and moves it so that it appears at the given x,y over the canvas,
         * allowing for the current zoom and pan.  It is expected that the element is not one that is currently
         * managed by the widget - a common use case for this is some dialog, which you do not want to append to
         * the canvas since it would have the zoom effect applied.
         * @method showElementAt
         * @param {Selector|Element|String} el Selector, DOM element or element id representing the element to move.
         * @param {Number} x X location to move to.
         * @param {Number} y Y location to move to.
         */
        this.showElementAt = function (el, x, y) {
            var de = domElement(el),
                dep = de.parentNode,
                depo = params.offset(dep),
                vpo = params.offset(viewport),
                _ao = _apparentOffset(),
                _x = (depo.left - vpo.left) + _ao[0] + x,
                _y = (depo.top - vpo.top) + _ao[1] + y;

            params.offset(el, {left: _x, top: _y});
        };

        /**
         * Returns the apparent [left,top] of the canvas inside the viewport - the coordinates, in real pixel
         * values, of where the origin of the canvas appears to be. This apparent origin is not necessarily the
         * same as the [left,top] values of the canvas, because the transform origin and zoom values change
         * things.  This function can be used in conjunction with the content bounds by widgets such as the miniview, to calculate what is actually visible in the
         * viewport at some point in time.
         * @method getApparentCanvasLocation
         * @return [Integer[]] [left,top] of the canvas, relative to the viewport's 0,0.
         */
        this.getApparentCanvasLocation = function () {
            var ao = _apparentOffset(),
                cp = _pos(canvasElement);

            return [ (cp[0] + ao[0]), (cp[1] + ao[1])];
        };

        /**
         * Sets the apparent canvas location - see the notes for getApparentCanvasLocation.
         * @method setApparentCanvasLocation
         * @param {Number} left Value in pixels for left edge of canvas.
         * @param {Number} top Value in pixels for top edge of canvas.
         * @return {Number[]} [left,top] of the actual origin set, after clamping.
         */
        this.setApparentCanvasLocation = function (left, top) {
            var ao = _apparentOffset();
            var actual = _pos(canvasElement, left - ao[0], top - ao[1], null, true);
            backgroundLayer && backgroundLayer.pan();
            fixedLayer && fixedLayer.pan();
            return actual;
        };

        /**
         * Applies either the widget's current zoom to the given element, or some supplied zoom.
         * @method applyZoomToElement
         * @param {Element} el Element to set zoom on.
         * @param {Number} [zoomToSet] Optional zoom value; if omitted we use the widget's current zoom.
         */
        this.applyZoomToElement = function (el, zoomToSet) {
            zoomToSet = zoomToSet || zoom;
            _applyTransformProperty("transform", "scale(" + zoomToSet + ")", el);
        };

        /**
         * Sets the transform origin for some element. This is really just exposed as a helper, since
         * there seems little point in reinventing the wheel if you have this widget in your codebase and you
         * need to perform this operation.  The Miniview uses this, for instance.
         * @method setTransFormOriginForElement
         * @param {Element} el Element to set transform origin for.
         * @param {Number[]} xy Transform origin for element.
         */
        this.setTransformOriginForElement = function (el, xy) {
            _applyTransformProperty("transformOrigin", xy[0] + " " + xy[1], el);
        };

        /**
         * Gets the current transform origin, in an object of the form `[ left, top ]`. The coordinate space is pixels.
         * @method getTransformOrigin
         * @return {Number[]} [left,top] values for the transform origin.
         */
        this.getTransformOrigin = function () {
            return transformOrigin;
        };

        /**
         * Appends an element to the viewport so that it floats above the content that is being zoomed and panned.
         * The element will have `position:absolute` set on it. You can float any element you like, but note that the
         * responsibility for setting an appropriate z index is yours.
         * @param {Element} el Element to float.
         * @param {Number[]} pos Array of [x,y] positions.
         */
        this.floatElement = function(el, pos) {
            if (el == null) return;
            el.style.position = "absolute";
            el.style.left = pos[0] + "px";
            el.style.top = pos[1] + "px";
            viewportElement.appendChild(el);
        };

        var fixedElements = {};
        var _fixElements = function(elId) {
            var acl = self.getApparentCanvasLocation();
            for (var fe in fixedElements) {
                if (fixedElements.hasOwnProperty(fe)) {
                    if (elId != null && elId != fe) continue;
                    var ce = fixedElements[fe];
                    var _one = function (prop, idx) {
                        if (ce[prop]) {
                            if ((acl[idx] / zoom) + ce.pos[idx] < 0) {
                                ce.el.style[prop] = -(acl[idx] / zoom) + "px";
                            }
                            else {
                                ce.el.style[prop] = ce.pos[idx] + "px";
                            }
                        }
                    };
                    _one("left", 0);
                    _one("top", 1);
                }
            }
        };
        var fixedLayer = {
            pan:_fixElements
        };
        /**
         * Appends an element to the content such that it is zoomed with everything else, but constrains pan
         * in one or both axes so that the element remains fixed with respect to the viewport origin.
         * @method fixElement
         * @param {Element} el The DOM element to append.
         * @param {Object} constraints Flags to indicate optional constraint to each axis.
         * @param {Number[]} pos [left,top] location of the element's origin.
         */
        this.fixElement = function(el, constraints, pos) {
            if (el == null) return;
            var elId = params.id(el);
            fixedElements[elId] = {
                el:el,
                left:constraints.left,
                top:constraints.top,
                pos:pos
            };
            el.style.position = "absolute";
            el.style.left = pos[0] + "px";
            el.style.top = pos[1] + "px";
            canvasElement.appendChild(el);
            _fixElements(elId);
        };

        /**
         * Finds all nodes that intersect to any extent the rectangle defined by the given origin
         * and dimensions. This rectangle is taken to be in the coordinate space of the page, ie. a value
         * of [0,0] for the origin means the page's top/left corner. A future version could take an optional
         * third argument specifying the element whose origin to use.
         * @method findIntersectingNodes
         * @param {Number[]} origin [x,y] location for center of search. IMPORTANT: This is relative to the page origin.
         * @param {Number[]} dimensions Width and height of search area.
         * @param {Boolean} [enclosed=false] If true, returns only nodes that are enclosed by the given search area. Otherwise returns nodes that both intersect and are enclosed.
         * @param {Function} [filter] Optional filter function. This is passed the (id, node, boundingRect) of some element and should return true for elements that should be included in results.
         * @return {Object[]} A list of objects containing {id:id, el:element, r:bounding rect} that either intersect or are enclosed by the search area.
         */
        this.findIntersectingNodes = function (origin, dimensions, enclosed, filter) {
            var cl = this.getApparentCanvasLocation(),
                vo = params.offset(viewportElement),
                sl = viewportElement.scrollLeft,
                st = viewportElement.scrollTop,
                n = [],
                r = { x: origin[0], y: origin[1], w: dimensions[0], h: dimensions[1] },
                compFn = enclosed ? Biltong.encloses : Biltong.intersects;

            // cl gives us the apparent origin of the canvas relative to the viewport,
            // and vo is the origin's viewport, so acl will give us the adjusted origin:
            var acl = [ vo.left + cl[0] - sl, vo.top + cl[1] - st ];

            for (var i in _elementPositions) {
                var p = _elementPositions[i],
                    r1 = { x: acl[0] + (p[0][0] * zoom), y: acl[1] + (p[0][1] * zoom), w: p[1] * zoom, h: p[2] * zoom };

                if (compFn(r, r1) && ( filter == null || filter(i, _nodeMap[i], r1) )) {
                    n.push({ id: i, el: _nodeMap[i], r: r1 });
                }
            }

            return n;
        };

        /**
         * Finds all nodes whose centers are within a rectangle with `origin` as its center, and
         * a width and height of `radius / 2`.
         * @method findNearbyNodes
         * @param {Number[]} origin [x,y] location for center of search. IMPORTANT: This is relative to the page origin.
         * @param {Number} radius Radius of search.
         * @param {Boolean} [mustBeInViewport=false] If true, first check that the given origin is within the viewport.
         * @param {Function} [filter] Optional filter function. Should return true for elements that should be included in results.
         * @return {Object[]} A list of objects containing {id:id, el:element, r:bounding rect}, sorted in ascending order of distance of the center of the bounding rectangle from the given origin.
         */
        this.findNearbyNodes = function (origin, radius, mustBeInViewport, filter) {
            var nodes = [];
            if (!mustBeInViewport || this.isInViewport(origin[0], origin[1])) {
                nodes = this.findIntersectingNodes(
                    [ origin[0] - radius, origin[1] - radius ],
                    [ radius * 2, radius * 2 ],
                    false,
                    filter);

                // map the origin to one that is in the same coord space as the nodes.
                var mappedOrigin = this.mapLocation(origin[0], origin[1]);
                nodes.sort(function (n1, n2) {
                    var c1 = [ n1.x + (n1.w / 2), n1.y + (n1.h / 2) ],
                        c2 = [ n2.x + (n2.w / 2), n2.y + (n2.h / 2) ],
                        d1 = Biltong.lineLength(mappedOrigin, c1),
                        d2 = Biltong.lineLength(mappedOrigin, c2);

                    return d1 < d2 ? -1 : d1 > d2 ? 1 : 0;
                });
            }

            return nodes;
        };

        /**
         * Returns whether or not the given point (relative to page origin) is within the viewport for the widget.
         * @method isInViewport
         * @param {Number} x X location of point to test
         * @param {Number} y Y location of point to test
         * @return {Boolean} True if the point is within the viewport, false if not.
         */
        this.isInViewport = function (x, y) {
            var o = params.offset(viewportElement),
                w = params.width(viewportElement),
                h = params.height(viewportElement);

            return (o.left <= x && x <= o.left + w) && (o.top <= y && y <= o.top + h);
        };

        /**
         * Returns the current map of element ids -> positions.
         * @method getElementPositions
         * @return {Object} Map of { id->[x,y]} positions.
         */
        this.getElementPositions = function () {
            return _elementPositions;
        };

        /**
         * Sets the filter used to determine whether or not a given event should begin a pan.
         * @method setFilter
         * @param {Function} f A function that will be given the current mouse event. You must return true from the function if you wish for a pan to begin.
         */
        this.setFilter = function (f) {
            filter = f || function (_) {
                return false;
            };
        };

        /**
         * Sets the filter used to determine whether or not a given wheel event should be responded to.
         * @method setWheelFilter
         * @param {Function} f A function that will be given the current mouse event. You must return false from the function if you wish for the wheel event to be responded to.
         */
        this.setWheelFilter = function (f) {
            wheelFilter = f || function (_) {
                return true;
            };
        };

        /**
         * Sets the background for the canvas element.
         * @method setBackground
         * @param {Object} params Method parameters
         * @param {Image} [params.img] Image to use. Optional; you can also supply an image url
         * @param {String} [params.url] Image URL.
         * @param {String} [params.type="simple"] "tiled" or "simple": whether to use a single background image or to tile it.
         * @param {String} [params.tiling="logarithmic"] Default is "logarithmic": each layer is assumed to have a maximum of
         * (2^level+1) tiles in each axis (for instance at level 0, 2 tiles in each axis.  Alternatively you can
         * set this to be "absolute", which means that at the maximum zoom level the number of tiles in each axis
         * is computed as the size of the image in that axis divided by the tile size in that axis (rounded up of course).
         * Then at subsequent levels below, the
         * @param {Function} [params.onBackgroundReady] Optional function to call when the image has loaded.
         */
        this.setBackground = function (params) {
            var type = params.type || "simple",
                clazz = {
                    "simple": SimpleBackground,
                    "tiled": params.tiling == "absolute" ? AbsoluteTiledBackground : LogarithmicTiledBackground
                };

            backgroundLayer = new clazz[type]({
                canvas: canvasElement,
                viewport: viewportElement,
                getWidth: widthFn,
                getHeight: heightFn,
                url: params.url,
                zoomWidget: self,
                onBackgroundReady: params.onBackgroundReady,
                options: params,
                img: params.img,
                resolver: params.resolver
            });
        };
        if (params.background) {
            this.setBackground(params.background);
        }

        /**
         * Gets the current background layer.
         * @return {Object} current background layer. you can use the `getWidth` and `getHeight` methods on this object to find out the background size.
         */
        this.getBackground = function () {
            return backgroundLayer;
        };

    };

    var SimpleBackground = function (params) {
        var canvas = params.canvas;
        var onBackgroundReady = params.onBackgroundReady || function () {
        };
        var backgroundImage = new Image();
        backgroundImage.onload = function () {
            canvas.style.backgroundImage = "url('" + backgroundImage.src + "')";
            canvas.style.backgroundRepeat = "no-repeat";
            canvas.style.width = backgroundImage.width + "px";
            canvas.style.height = backgroundImage.height + "px";
            onBackgroundReady(this);
        };
        backgroundImage.src = params.img ? params.img.src : params.url;

        this.owns = function (el) {
            return el == canvas;
        };

        this.getWidth = function () {
            return backgroundImage.width || 0;
        };
        this.getHeight = function () {
            return backgroundImage.height || 0;
        };

        this.setZoom = this.pan = function (_) {
        };
    };

    var TiledBackground = function (params) {
        var self = this;
        var canvas = params.canvas;
        var viewport = params.viewport;
        if (params.options.maxZoom == null) throw new TypeError("Parameter `maxZoom` not set; cannot initialize TiledBackground");
        if (!params.options.tileSize) throw new TypeError("Parameter `tileSize not set; cannot initialize TiledBackground. It should be an array of [x,y] values.");
        if (!params.options.width || !params.options.height) throw new TypeError("Parameters `width` and `height` must be set");
        // otherwise we create a Layer for each level. The assumption is that zoom levels start at 0.
        var Layer = function (zoom) {
            var container = document.createElement("div");
            container.style.position = "relative";
            container.style.height = "100%";
            container.style.width = "100%";
            container.style.display = "none";
            params.canvas.appendChild(container);
            this.zoom = zoom;

            var specs = self.getTileSpecs(zoom),
                _images = [],
                _url = function (z, x, y) {
                    return params.url.replace("{z}", z)
                        .replace("{x}", x)
                        .replace("{y}", y);
                },
                _resolver = function (z, x, y) {
                    if (params.resolver == null) {
                        return _url(z, x, y)
                    }
                    else {
                        return params.resolver(z, x, y);
                    }
                };

            this.apparentZoom = Math.min(specs[2], specs[3]);
            this.setActive = function (a) {
                container.style.display = a ? "block" : "none";
            };
            this.xTiles = specs[0];
            this.yTiles = specs[1];

            // initialize backing image store.
            for (var i = 0; i < this.xTiles; i++) {
                _images[i] = _images[i] || [];
                for (var j = 0; j < this.yTiles; j++) {
                    var img = document.createElement("img");
                    img._tiledBg = true;
                    img.className = "jtk-surface-tile";
                    img.ondragstart = function () {
                        return false;
                    };
                    container.appendChild(img);
                    img.style.position = "absolute";
                    img.style.opacity = 0;
                    _images[i][j] = [ img, new Image(), false ];
                }
            }

            var iwh = Math.pow(2, params.options.maxZoom - zoom) * params.options.tileSize[0];
            this.scaledImageSize = iwh;

            var _load = function (imgEl, img, x, y) {
                imgEl.style.left = (x * iwh) + "px";
                imgEl.style.top = (y * iwh) + "px";
                imgEl.style.width = iwh + "px";
                imgEl.style.height = iwh + "px";
                img.onload = function () {
                    imgEl.setAttribute("src", img.src);
                    imgEl.style.opacity = 1;
                };
                img.src = _resolver(zoom, x, y);
            };

            this.ensureLoaded = function (xo, yo, xf, yf) {
                for (var i = xo; i <= xf; i++) {
                    for (var j = yo; j <= yf; j++) {
                        if (_images[i] != null && _images[i][j] != null) {
                            if (!_images[i][j][2]) {
                                _load(_images[i][j][0], _images[i][j][1], i, j);
                                _images[i][j][2] = true;
                            }
                        }
                    }
                }
            };
        }.bind(this);

        var layers = [], currentLayer = null;
        for (var i = 0; i <= params.options.maxZoom; i++) {
            layers.push(new Layer(i));
        }

        canvas.style.width = params.options.width + "px";
        canvas.style.height = params.options.height + "px";

        var widgetZoom;

        // maps the current widget zoom to a zoom layer from our set. Returns the layer index.
        var _mapZoomToLayer = function () {
            if (widgetZoom <= layers[0].apparentZoom) return 0;
            else if (widgetZoom >= layers[layers.length - 1].apparentZoom) return layers.length - 1;
            else {
                for (var i = layers.length - 1; i > 0; i--) {
                    if (layers[i].apparentZoom >= widgetZoom && widgetZoom >= layers[i - 1].apparentZoom) {
                        return i;
                    }
                }
            }
        };

        //
        // calculates the current scale for the given layer, relative to the widget's zoom.
        // then performs a relayout of the images, resizing and repositioning as necessary
        //
        var _calculateScale = function (layerIndex) {
            var l = layers[layerIndex];
            if (currentLayer != null && currentLayer != l) currentLayer.setActive(false);
            l.setActive(true);
            currentLayer = l;
        };

        //
        // for currentLayer, ensures that all of the required tiles are loaded. This means calculating the overlap
        // between the viewport and the tile layer, taking into account the current origin of the canvas and the
        // zoom level (as well as, of course, the size of the viewport).
        //
        var _ensureVisibleTiles = function () {
            var loc = params.zoomWidget.getApparentCanvasLocation(),
                vw = params.getWidth(viewport),
                vh = params.getHeight(viewport),
                tileW = currentLayer.scaledImageSize * widgetZoom,
                tileH = currentLayer.scaledImageSize * widgetZoom,
                xo = loc[0] < 0 ? Math.floor(-loc[0] / tileW) : loc[0] < vw ? 0 : null,
                yo = loc[1] < 0 ? Math.floor(-loc[1] / tileH) : loc[1] < vh ? 0 : null,
                xf = Math.min(currentLayer.xTiles, Math.floor((vw - loc[0]) / tileW)),
                yf = Math.min(currentLayer.yTiles, Math.floor((vh - loc[1]) / tileH));

            // if either axis outside of the viewport, exit.
            if (xo == null || yo == null) return;

            currentLayer.ensureLoaded(xo, yo, xf, yf);
        };

        // for testing.
        this.getCurrentLayer = function () {
            return currentLayer;
        };

        this.getWidth = function () {
            return params.options.width;
        };
        this.getHeight = function () {
            return params.options.height;
        };

        var panDebounceTimeout = params.options.panDebounceTimeout || 50,
            zoomDebounceTimeout = params.options.zoomDebounceTimeout || 120,
            debounce = function (fn, timeout) {
                timeout = timeout || 150;
                var _t = null;
                return function () {
                    window.clearTimeout(_t);
                    _t = window.setTimeout(fn, timeout);
                };
            },
            _doUpdateZoom = function () {
                _calculateScale(_mapZoomToLayer());
                _ensureVisibleTiles();
            },
            _debounceUpdateZoom = debounce(_doUpdateZoom, zoomDebounceTimeout),
            _doEnsureVisibleTiles = debounce(_ensureVisibleTiles, panDebounceTimeout);

        this.setZoom = function (z, doNotDebounce) {
            widgetZoom = z;
            doNotDebounce ? _doUpdateZoom() : _debounceUpdateZoom();
        };

        this.pan = _doEnsureVisibleTiles;

        this.owns = function (el) {
            return el == canvas || el._tiledBg == true;
        };

        this.setZoom(params.zoomWidget.getZoom(), true);

        // finally, execute the onBackgroundReady callback immediately, if it was provided, since there is
        // no specific time at which you can say the tiled layer is completely done.
        if (params.onBackgroundReady != null)
            setTimeout(params.onBackgroundReady, 0);
    };

    var LogarithmicTiledBackground = function (params) {

        var width = params.options.width,
            height = params.options.height,
            tileSize = params.options.tileSize;

        this.getTileSpecs = function (zoom) {
            var arx = width > height ? 1 : width / height,
                ary = height > width ? 1 : height / width;

            var _w = Math.pow(2, zoom + 1) * tileSize[0] * arx,
                _h = Math.pow(2, zoom + 1) * tileSize[1] * ary,
                _xTiles = Math.ceil(_w / tileSize[0]),
                _yTiles = Math.ceil(_h / tileSize[1]);

            return [ _xTiles, _yTiles, _w / width, _h / height ];
        };

        TiledBackground.apply(this, arguments);
    };

    var AbsoluteTiledBackground = function (params) {

        var maxZoom = params.options.maxZoom,
            width = params.options.width,
            height = params.options.height,
            tileSize = params.options.tileSize;

        this.getTileSpecs = function (zoom) {
            var divisor = Math.pow(2, maxZoom - zoom); // how much to divide the dimensions by when calculating image dimensions
            var xTiles = Math.ceil((width / divisor) / tileSize[0]),  // tiles in x axis
                yTiles = Math.ceil((height / divisor) / tileSize[1]);  // tiles in y axis

            return [
                xTiles,
                yTiles,
                    (xTiles * tileSize[0]) / width,
                    (yTiles * tileSize[1]) / height
            ];
        };

        TiledBackground.apply(this, arguments);
    };


}).call(this);

;
(function () {

    "use strict";
    var root = this,
        JTK = root.jsPlumbToolkit,
        exports = JTK.Renderers,
        JP = root.jsPlumb,
        JUTIL = root.jsPlumbUtil,
        $j = jsPlumb.getSelector,
        _cl = jsPlumbToolkit.Classes,
        _c = jsPlumbToolkit.Constants,
        _e = jsPlumbToolkit.Events;

    /**
     * A widget that provides pan/zoom functionality, as well as the ability to load/store state in the browser.
     * You do not construct an instance of this class manually: you obtain an instance of Surface via a call to the `render`
     * method on a `jsPlumbToolkitInstance`. But the supported parameters to that `render` method are whatever is supported by
     * the Surface constructor, as documented here.
     * @class Surface
     * @extends AbstractRenderer
     * @constructor
     * @param {Object} params Constructor parameters
     * @param {Element|Selector} params.container Element to convert into a Surface.
     * @param {Boolean} [params.elementsDraggable=true] Whether or not elements in the Surface should be draggable.
     * @param {Object} [params.dragOptions] Options for draggable nodes.
     * @param {Object} [params.events] Optional event bindings. See documentation.
     * @param {Object} [params.miniview] Optional miniview configuration.
     * @param {Element|String|Selector} [params.miniview.container] Container for the miniview.  An Element, an element id, or a selector.
     * @param {Boolean} [params.miniview.initiallyVisible=true] Whether or not the miniview should be invisible until some data is loaded.
     * @param {String} [params.mode="Pan"] Mode to initialize the Surface in.
     * @param {Number} [params.panDistance=50] How far a pan nudge should move the UI (in pixels).
     * @param {Number} [params.zoom=1] Initial zoom for the widget.
     * @param {Number[]} [params.zoomRange=[0.05, 3] ] Zoom range for the widget.
     * @param {Boolean} [params.enablePan=true] Whether or not panning (via mouse drag) is enabled.
     * @param {Boolean} [params.enableWheelZoom=true] Whether or not zooming with the mouse wheel is enabled.
     * @param {Boolean} [params.enableAnimation=true] Enable animations for panning. Defaults to true.
     * @param {String} [params.wheelFilter] Optional CSS selector representing elements that should not respond to wheel zoom.
     * @param {String|Function} [params.panFilter] Optional; either a CSS selector representing elements that should allow a pan event to begin, or a function that will be
     *                          called with the event target. Returning true from this function means the widget should respond to the event.
     * @param {Number} [params.wheelSensitivity=10] How many pixels each click of the mouse wheel represents when zooming. Note that this value, while expressed in pixels, is mapped in a variety of ways depending on the browser.
     * @param {Boolean} [params.enablePanButtons=true] Whether or not to show the pan nudge buttons on the borders of the widgets.
     * @param {Number[]} [params.padding] Optional values for padding in the x/y axes to leave around the content. This is only of any use if you have disabled panning via mouse drag,
     * since in that case the user sees only scroll bars and has no way of navigating beyond the content. Some padding makes the UI nicer to use. Default is [0,0].
     * @param {String} [params.lassoFilter] Optional selector for elements on which a mousedown should not cause the lasso to activate.
     * @param {Function} [params.lassoSelectionFilter] Optional function that can be used to filter the set of nodes a lasso drag is selecting. The function is given each candidate Node in turn; returning false indicates the Node should not be selected.
     * @param {Boolean} [params.consumeRightClick=true] Useful for development: set this to false if you don't want the widget to consume context menu clicks.
     * @param {String} [params.stateHandle] If supplied, this will be used as the default handle for state save/restore operations.
     * @param {Boolean} [params.clamp=true] Whether to clamp when panning such that there is always content visible.
     * @param {Boolean} [params.clampZoom=true] Whether to clamp when zooming such that there is always content visible.
     * @param {Boolean} [params.clampToBackground=false] If a background is set, whether to clamp movement such that some part of the background is always visible.
     * @param {Boolean} [params.clampToBackgroundExtents=false] If a background is set, whether to clamp movement such that the background fills as much of the viewport as it can.
     * @param {Object} [params.background] Optional background image parameters
     * @param {String} [params.background.url] URL for the background. Required for both single images and tiled backgrounds.
     * @param {String} [params.background.type="simple"] "simple" or "tiled" - the type of background.
     * @param {Number[]} [params.background.tileSize] For tiled backgrounds, provides the width and height of tiles. Every tile is assumed to have these dimensions, even if the tile has whitespace in it.
     * @param {Number} [params.background.width] Required for tiled backgrounds. Indicates the width of the full image.
     * @param {Number} [params.background.height] Required for tiled backgrounds. Indicates the height of the full image.
     * @param {Number} [params.background.maxZoom] Required for tiled backgrounds. Indicates the maximum zoom level. Zoom starts at 0 - fully zoomed out - and increases in integer values from there. Eash successive zoom level is twice the zoom of the previous level, meaning two times as many tiles in each direction.
     * @param {Object} [params.jsPlumb] Optional set of jsPlumb Defaults to use for this renderer. The format and allowed properties is that of
     * the Defaults object in jsPlumb. You can also set display properties in the view.
     * @param {Boolean} [params.autoExitSelectMode=true] When true (which is the default), the Surface will automatically jump back into Pan mode after some nodes have been selected.
     * @param {Boolean} [params.zoomToFit=false] If true, content will be zoomed to fit the viewport when a dataLoadEnd event is received.
     * @param {Boolean} [params.zoomToFitIfNecessary=false] If true, content will be zoomed to fit the viewport, if necessary (meaning if it fits inside the viewport already it wont be zoomed, which is different from how `zoomToFit` works) when a dataLoadEnd event is received. If this and `zoomToFit` are both set, this takes precedence.
     * @param {Boolean} [params.storePositionsInModel=true] By default, the left/top positions of nodes that have been dragged will be written into the data for each node after drag stops. You can set this to false to disable that behaviour.
     * @param {String} [params.modelLeftAttribute="left"] Optional; specifies the name of the attribute by which to store the x position of a dragged node of `storePositionsInModel` is true.
     * @param {String} [params.modelTopAttribute="top"] Optional; specifies the name of the attribute by which to store the y position of a dragged node of `storePositionsInModel` is true.
     * @param {Function} [params.assignPosse] optional function that, given each node, can return the id of the posse to which the node belongs. a Posse is a group of nodes that should all be dragged together.
     */
    exports.Surface = function (params) {
        var self = this;
        /**
         * Constant for the Select mode.
         * @property SELECT
         * @type {String}
         */
        exports.Surface.SELECT = _c.select;
        /**
         * Constant for the Pan mode.
         * @property PAN
         * @type {String}
         */
        exports.Surface.PAN = _c.pan;
        /**
         * Constant for the Disabled mode.
         * @property DISABLED
         * @type {String}
         */
        exports.Surface.DISABLED = _c.disabled;

        var _super = exports.AbstractRenderer.apply(this, arguments);
        exports.DOMElementAdapter.apply(this, arguments);
        this.getObjectInfo = _super.getObjectInfo;

        params = params || {};
        var containerElement = JP.getElement(params.container),
            canvasElement = exports.createElement({ position: _c.relative, width: _c.nominalSize, height: _c.nominalSize, left: 0, top: 0, clazz: _cl.SURFACE_CANVAS }, containerElement),
            elementsDraggable = !(params.elementsDraggable === false),
            elementsDroppable = params.elementsDroppable === true,
            dragOptions = params.dragOptions || {},
            dropOptions = params.dropOptions || {},
            stateHandle = params.stateHandle,
            _storePositionsInModel = params.storePositionsInModel !== false,
            _modelLeftAttribute = params.modelLeftAttribute,
            _modelTopAttribute = params.modelTopAttribute,
            panzoom = new ZoomWidget({
                viewport: containerElement,
                canvas: canvasElement,
                domElement: _super.jsPlumb.getElement,
                addClass: _super.jsPlumb.addClass,
                removeClass: _super.jsPlumb.removeClass,
                offset: this.getOffset,
                consumeRightClick: params.consumeRightClick,
                bind: function () {
                    _super.jsPlumb.on.apply(_super.jsPlumb, arguments);
                },
                unbind: function () {
                    _super.jsPlumb.off.apply(_super.jsPlumb, arguments);
                },
                width: function (el) {
                    return _super.jsPlumb.getWidth(_super.jsPlumb.getElement(el))
                },
                height: function (el) {
                    return _super.jsPlumb.getHeight(_super.jsPlumb.getElement(el))
                },
                id: _super.jsPlumb.getId,
                animate: function() { _super.jsPlumb.animate.apply(_super.jsPlumb, arguments) },
                dragEvents: {
                    "stop": jsPlumb.dragEvents[_c.stop],
                    "start": jsPlumb.dragEvents[_c.start],       // map drag concepts to event names.
                    "drag": jsPlumb.dragEvents[_c.drag]
                },
                background:params.background,
                padding: params.padding,
                panDistance: params.panDistance,
                enablePan: params.enablePan,
                enableWheelZoom: params.enableWheelZoom,
                wheelSensitivity: params.wheelSensitivity,
                enablePanButtons: params.enablePanButtons,
                enableAnimation:params.enableAnimation,
                clamp: params.clamp,
                clampZoom: params.clampZoom,
                clampToBackground: params.clampToBackground,
                clampToBackgroundExtents: params.clampToBackgroundExtents,
                zoom:params.zoom,
                zoomRange:params.zoomRange,
                extend: _super.jsPlumb.extend,          // provide an 'extend' function to use
                events: {
                    pan: function (x, y, z, oldZoom, e) {
                        self.fire(_e.pan, {
                            x: x,
                            y: y,
                            zoom: z,
                            oldZoom: oldZoom,
                            event: e
                        });
                    },
                    zoom: function (x, y, z, oldZoom, e) {
                        _super.jsPlumb.setZoom(z);
                        self.fire(_e.zoom, {
                            x: x,
                            y: y,
                            zoom: z,
                            oldZoom: oldZoom,
                            event: e
                        });
                    },
                    mousedown: function () {
                        jsPlumb.addClass(containerElement, _cl.SURFACE_PANNING);
                    },
                    mouseup: function () {
                        jsPlumb.removeClass(containerElement, _cl.SURFACE_PANNING);
                    }
                }
            }),
            lassoSelections = [],
            lassoSelectionFilter = params.lassoSelectionFilter,
            autoExitSelectMode = params.autoExitSelectMode !== false,
            lasso = new JTK.Widgets.Lasso({
                on: function () {
                    _super.jsPlumb.on.apply(_super.jsPlumb, arguments);
                },
                off: function () {
                    _super.jsPlumb.off.apply(_super.jsPlumb, arguments);
                },
                pageLocation: panzoom.pageLocation,
                canvas: containerElement,
                onStart: function () {
                    self.setHoverSuspended(true);
                    lassoSelections.length = 0;
                },
                onSelect: function (origin, size, directions, shiftDown) {
                    var n = [], nodes = panzoom.findIntersectingNodes(origin, size, !directions[0]);
                    _super.jsPlumb.clearDragSelection && _super.jsPlumb.clearDragSelection();
                    _super.toolkit.clearSelection();
                    if (shiftDown && lassoSelections.length > 0) {
                        // clear last lasso selections if shift down.
                        _super.toolkit.deselect(lassoSelections);
                    }
                    for (var i = 0; i < nodes.length; i++) {
                        if (lassoSelectionFilter == null || lassoSelectionFilter(nodes[i].el.jtk.node) !== false) {
                            n.push(nodes[i].el.jtk.node);
                            _super.jsPlumb.addToDragSelection && _super.jsPlumb.addToDragSelection(nodes[i].el);
                        }
                    }
                    lassoSelections = n;
                    _super.toolkit.addToSelection(n, shiftDown);
                },
                onEnd: function () {
                    self.setHoverSuspended(false);
                    if (autoExitSelectMode) {
                        self.setMode(_c.pan);
                    }
                },
                filter: params.lassoFilter
            }),
            modes = {
                "pan": function () {
                    lasso.setEnabled(false);
                    panzoom.setEnabled(true);
                },
                "select": function () {
                    _super.jsPlumb.clearDragSelection && _super.jsPlumb.clearDragSelection();
                    lasso.setEnabled(true);
                    panzoom.setEnabled(false);
                },
                "disabled": function () {
                    _super.jsPlumb.clearDragSelection && _super.jsPlumb.clearDragSelection();
                    lasso.setEnabled(true);
                    panzoom.setEnabled(false);
                }
            },
            _mode = params.mode || _c.pan,
            miniview;

        // bind to relayout and tell the panzoom
        self.bind(_e.relayout, function (boundsInfo) {
            panzoom.relayout(boundsInfo, true);
        });

        // bind to noderemoved and tell the panzoom
        self.bind(_e.nodeRemoved, function (p) {
            panzoom.remove(p.el);
        });

        // on graph clear, reset panzoom
        _super.toolkit.bind(_e.graphCleared, function () {
            panzoom.reset();
        });

        _super.toolkit.bind(_e.dataLoadStart, function () {
            panzoom.setSuspendRendering(true);
        });

        _super.toolkit.bind(_e.dataLoadEnd, function () {
            panzoom.setSuspendRendering(false);
            miniview && miniview.setVisible(true);
            if (params.zoomToFit)
                self.zoomToFit();
        });

        // set our canvas as the root element for everything the associated jsPlumb instance adds to the UI.
        _super.jsPlumb.setContainer(canvasElement);

        // set the jtk-surface class on the container
        jsPlumb.addClass(containerElement, _cl.SURFACE);

        // optionally set the jtk-surface-nopan class
        if (params.enablePan === false)
            jsPlumb.addClass(containerElement, _cl.SURFACE_NO_PAN);

        // support for canvasClick and canvasDblClick listener
        var _canvasBind = function (evt, alias) {
            var cc = function (e) {
                var t = e.srcElement || e.target;
                if (t == containerElement || t == canvasElement)
                    self.fire(alias, e);
            };
            _super.jsPlumb.on(canvasElement, evt, cc);
            _super.jsPlumb.on(containerElement, evt, cc);
        };
        _canvasBind(_e.tap, _e.canvasClick);
        _canvasBind(_e.dblclick, _e.canvasDblClick);
        var contentBounds = null; // current bounds as tracked by the panzoom

        //
        // make an element draggable. abstract method for superclass.
        //
        _super.makeDraggable = function (el, nodeDefDragOptions) {
            // init as draggable
            if (elementsDraggable) {
                var domEl = JP.getElement(el), id = _super.jsPlumb.getId(domEl);
                var _dragOptions = _super.jsPlumb.extend({}, dragOptions),
                    stopEvent = JP.dragEvents[_c.stop],
                    startEvent = JP.dragEvents[_c.start],
                    _getDragInfo = function (args) {
                        var dragObject = JP.getDragObject(args),
                            dragDOMElement = JP.getElement(dragObject);

                        return {
                            node: dragDOMElement.jtk.node,
                            el: dragObject
                        };
                    };

                // if the node definition provided drag options, override the common ones now,
                // but before we wrap any callbacks.
                if (nodeDefDragOptions != null)
                    _super.jsPlumb.extend(_dragOptions, nodeDefDragOptions);

                _dragOptions[startEvent] = JUTIL.wrap(_dragOptions[startEvent], function () {
                    contentBounds = panzoom.getBoundsInfo();
                    var dragInfo = _getDragInfo(arguments);
                    dragInfo.elementId = id;
                    dragInfo.pos = jsPlumb.getAbsolutePosition(domEl);
                    dragInfo.domEl = domEl;
                    jsPlumb.addClass(containerElement, _cl.SURFACE_ELEMENT_DRAGGING);
                    self.fire(_e.nodeMoveStart, dragInfo);
                });

                _dragOptions[stopEvent] = JUTIL.wrap(_dragOptions[stopEvent], function (params) {
                    var _one = function(info) {
                        panzoom.positionChanged(info[0]);
                        jsPlumb.removeClass(containerElement, _cl.SURFACE_ELEMENT_DRAGGING);
                        var dragInfo = {
                            el:info[0],
                            node:info[0].jtk.node,
                            pos:[ info[1].left, info[1].top ]
                        };
                        self.getLayout().setPosition(dragInfo.node.id, dragInfo.pos[0], dragInfo.pos[1], true);
                        if (_storePositionsInModel !== false) {
                            self.storePositionInModel({
                                id:dragInfo.node.id,
                                leftAttribute:_modelLeftAttribute,
                                topAttribute:_modelTopAttribute
                            });
                            _super.toolkit.fire("nodeUpdated", { node:dragInfo.node }, null);
                        }
                        self.fire(_e.nodeMoveEnd, dragInfo);
                    };
                    for (var i = 0; i < params.selection.length; i++)
                        _one(params.selection[i]);
                });

                _dragOptions.canDrag = function () {
                    return !lasso.isActive();
                };

                _dragOptions.force = true;

                _super.jsPlumb.draggable(domEl, _dragOptions, false, _super.jsPlumb);
            }
        };

        _super.makeDroppable = function (el, nodeDefDropOptions) {
            // init as droppable
            if (elementsDroppable) {
                var domEl = JP.getElement(el), id = _super.jsPlumb.getId(domEl);
                var _dropOptions = _super.jsPlumb.extend({}, dropOptions);

                if (nodeDefDropOptions != null)
                    _super.jsPlumb.extend(_dropOptions, nodeDefDropOptions);

                _dropOptions["drop"] = JUTIL.wrap(_dropOptions["drop"], function (params) {
                    var dropInfo = {
                        source:params.drag.el.jtk.node,
                        sourceElement:params.drag.el,
                        target:params.drop.el.jtk.node,
                        targetElement:params.drop.el,
                        e:params.e
                    };
                    self.fire(_e.nodeDropped, dropInfo);
                });

                _super.jsPlumb.droppable(domEl, _dropOptions);
            }
        };

        // for the case that a set of nodes were imported from an existing instance of jsPlumb. we have to tell
        // the pan/zoom widget about all of these nodes.
        // this was called by the superclass, during its initialize method. it does Surface specific stuff, like
        // switching the jsplumb instance's container to our canvas, and ensuring that each node is registered
        // with the pan/zoom widget.
        _super.doImport = function (nodeMap) {
            // tell the jsplumb instance to change its container
            params.jsPlumbInstance.setContainer(canvasElement);
            var managedElements = params.jsPlumbInstance.getManagedElements();
            for (var id in managedElements) {
                var el = managedElements[id].el;
                _importNode(el, id);
            }
        };

        var _importNode = this.importNode = function(el, id) {
            var offs = params.jsPlumbInstance.getOffset(el);
            var elId = params.jsPlumbInstance.getId(el);
            // ensure the left/top is set on the element, by using the standard getOffset function
            // and writing the values to the el.
            el.style.left = offs.left + _c.px;
            el.style.top = offs.top + _c.px;
            jsPlumb.addClass(el, _cl.NODE);
            panzoom.add(el, elId, [offs.left, offs.top], false);
            // make draggable!
            if (jsPlumb.isAlreadyDraggable(el)) {
                _super.makeDraggable(el);
            }
            _super.nodeMap[id] = el;
            _super.reverseNodeMap[elId] = el.jtk.node;
        };

        /**
         * Zooms the display so that all the tracked elements fit inside the viewport. This method will also,
         * by default, increase the zoom if necessary - meaning the default behaviour is to adjust the zoom so that
         * the content fills the viewport. You can suppress zoom increase by setting `doNotZoomIfVisible:true` on the
         * parameters to this method.
         * @method zoomToFit
         * @param {Object} [params]
         * @param {Number} [params.padding=20] Optional padding to leave around all elements.
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotAnimate=true] By default, the centering content step does not use animation. This is due to this method being used most often to initially setup a UI.
         * @param {Boolean} [params.doNotZoomIfVisible=false] If true, no action is taken if the content is currently all visible.
         * @param {Boolean} [params.doNotFirePanEvent=false] If true, a pan event will not be fired.
         */
        this.zoomToFit = panzoom.zoomToFit;

        /**
         * Zooms the display so that all the tracked elements fit inside the viewport, but does not make any adjustments
         * to zoom if all the elements are currently visible (it still does center the content though).
         * @method zoomToFitIfNecessary
         * @param {Object} [params]
         * @param {Number} [params.padding = 20] Optional padding to leave around all elements.
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotAnimate=true] By default, the centering content step does not use animation. This is due to this method being used most often to initially setup a UI.
         */
        this.zoomToFitIfNecessary = panzoom.zoomToFitIfNecessary;

        /**
         * Zooms the display so that the current selected nodes are all visible.
         * @method zoomToSelection
         * @param [params] {Object} Optional method params
         * @param [params.doNotZoomIfVisible=false] If true and the widget determines the entire selection is already
         * visible, the zoom will not be adjusted.
         */
        this.zoomToSelection = function(params) {
            var sel = _super.toolkit.getSelection(), els = [];
            sel.eachNode(function(idx, n) {
                els.push(_super.getElement(n.id));
            });

            if (els.length > 0) {
                panzoom.zoomToElements({elements:els});
            }
        };

        /**
         * Zooms the display so that the background fits inside the viewport.
         * @method zoomToBackground
         * @param {Object} [params]
         * @param {Function} [params.onComplete] Optional function to call on operation complete (centering may be animated).
         * @param {Function} [params.onStep] Optional function to call on operation step (centering may be animated).
         * @param {Boolean} [params.doNotAnimate=false] If true, centering content will not use animation.
         */
        this.zoomToBackground = panzoom.zoomToBackground;

        /**
         * Centers the given object in the viewport. You can pass in a DOM element or a Toolkit Node here.
         * @method centerOn
         * @param {Node|Element|String} obj Object to center in the viewport - a Node, Element, or Node id.
         * @param {Object} [params] Optional extra parameters.
         * @param {Boolean} [params.horizontal=true] Whether or not to center horizontally
         * @param {Boolean} [params.vertical=true] Whether or not to center vertically
         * @param {Boolean} [params.doNotAnimate=false] If true, animation will not be switched on for the operation.
         * @param {Boolean} [params.onComplete] Optional on complete callback
         * @param {Boolean} [params.onStep] Optional on animation step callback.
         */
        this.centerOn = function (obj, params) {
            var info = this.getObjectInfo(obj);
            info && info.el && panzoom.centerOn(info.el, params);
        };

        /**
         * Centers the given element in the viewport, horizontally only.
         * @method centerOnHorizontally
         * @param {Element|String} element Element, or element id, to center.
         */
        this.centerOnHorizontally = function (element) {
            this.centerOn(element, {vertical:false});
        };

        /**
         * Centers the given element in the viewport, vertically only.
         * @method centerOnHorizontally
         * @param {Element|String} element Element, or element id, to center.
         */
        this.centerOnVertically = function (element) {
            this.centerOn(element, {horizontal:false});
        };

        /**
         * Centers on the given element and then adjusts the zoom of the widget so that the short axis of the viewport
         * is [1 / fillRatio] larger than its corresponding axis on the centered node. `fillRatio` is basically
         * a measure of how much context you want to see around the node on which you centered.
         * @method centerOnAndZoom
         * @param {Element|String} element Element, or element id, to center.
         * @param {Number} [fillRatio=0.6] Proportional ratio of the corresponding node's edge to the viewport's short edge.
         */
        this.centerOnAndZoom = function(obj, fillRatio) {
            var info = this.getObjectInfo(obj);
            info && info.el && panzoom.centerOnAndZoom(info.el, fillRatio);
        };

        /**
         * Centers the content in the viewport.
         * @method centerContent
         */
        this.centerContent = panzoom.centerContent;

        /**
         * Centers the content in the viewport horizontally.
         * @method centerContentHorizontally
         */
        this.centerContentHorizontally = panzoom.centerContentHorizontally;

        /**
         * Centers the content in the viewport vertically.
         * @method centerContentVertically
         */
        this.centerContentVertically = panzoom.centerContentVertically;

        /**
         * Gets the canvas location that corresponds to the center of the viewport.  Note that this may describe
         * a point outside of the content bounds.
         * @method getViewportCenter
         * @return {Number[]} left,top location of the logical position on the canvas corresponding to the center of the viewport.
         */
        this.getViewportCenter = panzoom.getViewportCenter;

        /**
         * Sets the location of the canvas such that the given point appears at the center of the viewport.
         * @method setViewportCenter
         * @param {Number[]} xy left, top location of the point on the canvas to position in the center of the viewport.
         */
        this.setViewportCenter = panzoom.setViewportCenter;

        /**
         * Sets the default handle to use for state save/restore operations.
         * @method setStateHandle
         * @param {String} handle Handle to use.
         */
        this.setStateHandle = function (handle) {
            stateHandle = handle;
        };

        /**
         * Gets the default handle to use for state save/restore operations.
         * @method getStateHandle
         * @return {String} Handle in use.
         */
        this.getStateHandle = function () {
            return stateHandle;
        };

        /**
         * Sets the current lasso selection filter function.
         * @method setLassoSelectionFilter
         * @param {Function} fn A function that takes Nodes as argument and returns false if the Node should not be
         * selected. Any other return value will cause the Node to be selected.
         */
        this.setLassoSelectionFilter = function(fn) {
            lassoSelectionFilter = fn;
        };

        /**
         * Returns the apparent [left,top] of the canvas inside the viewport - the coordinates, in real pixel
         * values, of where the origin of the canvas appears to be. This apparent origin is not necessarily the
         * same as the [left,top] values of the canvas, because the transform origin and zoom values change
         * things.  This function can be used in conjunction with the content bounds by widgets such as the miniview,
         * to calculate what is actually visible in the viewport at some point in time.
         * @method getApparentCanvasLocation
         * @return [Number[]] [left,top] of the canvas, relative to the viewport's 0,0.
         */
        this.getApparentCanvasLocation = panzoom.getApparentCanvasLocation;

        /**
         * Sets the apparent canvas location - see the notes for getApparentCanvasLocation.
         * @method setApparentCanvasLocation
         * @param {Number} left Value in pixels for left edge of canvas.
         * @param {Number} top Value in pixels for top edge of canvas.
         * @return {Number[]} [left,top] of the actual origin set, after clamping.
         */
        this.setApparentCanvasLocation = panzoom.setApparentCanvasLocation;

        /**
         * Gets the current bounds information.
         * @method getBoundsInfo
         */
        this.getBoundsInfo = panzoom.getBoundsInfo;

        /**
         * Sets the current zoom, clamping it to the allowed range.
         * @method setZoom
         * @param {Number} zoom Zoom value. If this is outside the allowed bounds it will be clamped.
         * @return {Number} Current zoom. This may or may not be the value you asked for - it might have been clamped to the current allowed zoom range.
         */
        this.setZoom = panzoom.setZoom;

        /**
         * Sets the current zoom range. By default, this method checks if the current zoom is within
         * the new range, and if it is not then `setZoom` is called, which will cause the zoom to be clamped
         * to an allowed value in the new range. You can disable this by passing `true` for `doNotClamp`.
         * @method setZoomRange
         * @param {Number[]} zr New range, as an array consisting of [lower, upper] values. Lower must be less than upper.
         * @param {Boolean} [doNotClamp] If true, will not check the current zoom to ensure it falls within the new range.
         */
        this.setZoomRange = panzoom.setZoomRange;

        /**
         * Gets the current zoom range.
         * @method getZoomRange
         * @return {Number[]} Array of [min, max] zoom values.
         */
        this.getZoomRange = panzoom.getZoomRange;

        /**
         * Gets the current zoom.
         * @method getZoom
         * @return {Number} Current zoom value
         */
        this.getZoom = panzoom.getZoom;

        /**
         * Nudges the zoom by the given amount. Zoom will be clamped to the current zoom range in effect and the
         * value that was ultimately set is returned from this function. The value you pass in here is multiplied by
         * 100 to give a percentage value: 1 is 100%, for instance, 0.05 is 5%.
         * @method nudgeZoom
         * @param {Number} delta Amount to change zoom by.
         * @param {Event} [e] Original event that caused the nudge. May be null.
         * @return {Number} The zoom that was set. Zoom will be clamped to the allowed range.
         */
        this.nudgeZoom = panzoom.nudgeZoom;

        /**
         * Nudges the wheel zoom by the given amount. This function is intended for use by components that control
         * zoom via the mouse wheel, and not for general usage. See `nudgeZoom` for a more general version of this.
         * @method nudgeWheelZoom
         * @param {Number} delta Amount to change zoom by.
         * @param {Event} [e] Original event that caused the nudge. May be null.
         */
        this.nudgeWheelZoom = panzoom.nudgeWheelZoom;

        /**
         * Decodes the page location from the given event, taking touch devices into account.
         * @method pageLocation
         * @return {Number[]} [left, top] of the given event.
         */
        this.pageLocation = panzoom.pageLocation;

        /**
         * Gets the current [left,top] of the panned content.
         * @method getPan
         * @return {Number[]} [left,top], in pixels, of the panned content, where [0,0] is the origin of the viewport.
         */
        this.getPan = panzoom.getPan;

        /**
         * Pans the content by dx and dy.
         * @method pan
         * @param {Number} dx Amount to pan in X direction
         * @param {Number} dy Amount to pan in Y direction
         * @param {Boolean} [animate = false] Whether or not to animate the pan.
         */
        this.pan = panzoom.pan;

        /**
         * Sets the position of the panned content's origin.
         * @method setPan
         * @param {Number} left Position in pixels of the left edge of the panned content.
         * @param {Number} top Position in pixels of the top edge of the panned content.
         * @param {Boolean} [animate = false] Whether or not to animate the pan.
         * @param {Function} [onComplete] If `animate` is set to true, an optional callback for the end of the pan.
         * @param {Function} [onStep] If `animate` is set to true, an optional callback for each frame in the pan.
         */
        this.setPan = panzoom.setPan;


        this.setPanAndZoom = function(x, y, zoom, doNotAnimate) {
            this.setPan(x, y, !doNotAnimate);
            this.setZoom(zoom, !doNotAnimate);
        };

        /**
         * Sets the filter used to determine whether or not a given event should begin a pan.
         * @method setPanFilter
         * @param {String|Function} f Either a CSS selector to use as a whitelist on the event target, or a function that will be given the target of the current mouse event. You must return true from the function if you wish for a pan to begin.
         */
        this.setPanFilter = function (f) {
            panzoom.setFilter(f ? function (d, e) {
                if (typeof f == "function")
                    return f.apply(f, [e]);
                else {
                    return JUTIL.matchesSelector(d, f);
                }
            } : null);
        };

        /**
         * Sets the filter used to determine whether or not a given wheel event should be responded to.
         * @method setWheelFilter
         * @param {String} filter A CSS selector to use as a blacklist on the event target.
         */
        this.setWheelFilter = function (filter) {
            panzoom.setWheelFilter(function (e) {
                if (!filter) return true;
                else {
                    var t = e.srcElement || e.target;
                    return !JUTIL.matchesSelector(t, filter);
                }
            });
        };

        this.setWheelFilter(params.wheelFilter);
        this.setPanFilter(params.panFilter);

        /**
         * Maps the given page location to an [x,y] location in the Surface's canvas.
         * @method mapLocation
         * @param {Number} x X location to map
         * @param {Number} y Y location to map
         */
        this.mapLocation = panzoom.mapLocation;

        /**
         * Maps the page location of the given event to an [x,y] location in the Surface's canvas.
         * @method mapEventLocation
         * @param {Event} e Event to map
         */
        this.mapEventLocation = panzoom.mapEventLocation;

        /**
         * Finds all nodes whose centers are within a rectangle with `origin` as its center, and
         * a width and height of `radius / 2`.
         * @method findNearbyNodes
         * @param {Number[]} [x,y] location for center of search
         * @param {Number} Radius of search.
         * @param {Boolean} [mustBeInViewport=false] If true, first check that the given origin is within the viewport.
         * @param {Function} [filter] Optional filter function. This is passed the (id, node, boundingRect) of some element and should return true for elements that should be included in results.
         * @return {Object[]} A list of objects containing {id:id, el:element, r:bounding rect}, sorted in ascending order of distance of the center of the bounding rectangle from the given origin.
         */
        this.findNearbyNodes = panzoom.findNearbyNodes;

        /**
         * Finds all nodes that intersect to any extent the rectangle defined by the given origin
         * and dimensions. This rectangle is taken to be in the coordinate space of the document, ie. a value
         * of [0,0] for the origin means the document's top/left corner. A future version could take an optional
         * third argument specifying the element whose origin to use.
         * @method findIntersectingNodes
         * @param {Number[]} origin [x,y] location for center of search
         * @param {Number[]} dimensions Width and height of search area.
         * @param {Boolean} [enclosed=false] If true, returns only nodes that are enclosed by the given search area. Otherwise returns nodes that both intersect and are enclosed.
         * @return {Object[]} A list of objects containing {id:id, el:element, r:bounding rect} that either intersect or are enclosed by the search area.
         */
        this.findIntersectingNodes = panzoom.findIntersectingNodes;

        /**
         * Returns whether or not the given point (relative to page origin) is within the viewport for the widget.
         * @method isInViewport
         * @param {Number} x X location of point to test
         * @param {Number} y Y location of point to test
         * @return {Boolean} True if the point is within the viewport, false if not.
         */
        this.isInViewport = panzoom.isInViewport;

        /**
         * Places (using `style.left` and `style.top`) the given element at the given x,y, which is taken to
         * mean an [x,y] value on the canvas.  At zoom 1, with no panning, this will be the same as the given [x,y] value
         * relative to the viewport origin.  But once the canvas has been zoomed and panned we have to map
         * to the altered coordinates. This function also takes into account the difference between the offset of the
         * viewport in the page and the offset of the given element. It is assumed, just because of what this method
         * does, that the given element will be positioned `absolute`, but this method does nothing to ensure that.
         * Note that this method - and its relatives, `positionElementAtEventLocation` and `positionElementAtPageLocation` - are
         * not intended for use with elements being managed by the Surface. They are for use with external
         * elements that you need to align with the contents of the Surface.
         * @method positionElementAt
         * @param {Selector|Element|String} el Element to position.
         * @param {Number} x X location on canvas to move element's left edge to.
         * @param {Number} y Y location on canvas to move element's top edge to.
         * @param {Number} [xShift=0] Optional absolute number of pixels to shift the element by in the x axis after calculating its position relative to the canvas. Typically you'd use this to place something other than the top left corner of your element at the desired location.
         * @param {Number} [yShift=0] Optional absolute number of pixels to shift the element by in the y axis after calculating its position relative to the canvas.
         */
        this.positionElementAt = panzoom.positionElementAt;

        /**
         * Places (using `style.left` and `style.top`) the given element at the page x,y corresponding to the given
         * event.  It is assumed, just because of what this method does, that the given element will be positioned
         * `absolute`, but this method does nothing to ensure that. Note that this method - and its relatives,
         * `positionElementAt` and `positionElementAtPageLocation` - are not intended for use with elements being
         * managed by the Surface. They are for use with external elements that you need to align with the contents
         * of the Surface.
         * @method positionElementAtEventLocation
         * @param {Selector|Element|String} el Element to position.
         * @param {Event} evt Event to position element at.
         * @param {Number} [xShift=0] Optional absolute number of pixels to shift the element by in the x axis after calculating its position relative to the canvas. Typically you'd use this to place something other than the top left corner of your element at the desired location.
         * @param {Number} [yShift=0] Optional absolute number of pixels to shift the element by in the y axis after calculating its position relative to the canvas.
         */
        this.positionElementAtEventLocation = panzoom.positionElementAtEventLocation;

        /**
         * Places (using `style.left` and `style.top`) the given element at the given page x,y.  It is assumed, just
         * because of what this method does, that the given element will be positioned `absolute`, but this method
         * does nothing to ensure that. Note that this method - and its relatives, `positionElementAtEventLocation`
         * and `positionElementAt` - are not intended for use with elements being managed by the Surface. They are
         * for use with external elements that you need to align with the contents of the Surface.
         * @method positionElementAtPageLocation
         * @param {Selector|Element|String} el Element to position.
         * @param {Number} x X location on canvas to move element's left edge to.
         * @param {Number} y Y location on canvas to move element's top edge to.
         * @param {Number} [xShift=0] Optional absolute number of pixels to shift the element by in the x axis after calculating its position relative to the canvas. Typically you'd use this to place something other than the top left corner of your element at the desired location.
         * @param {Number} [yShift=0] Optional absolute number of pixels to shift the element by in the y axis after calculating its position relative to the canvas.
         */
        this.positionElementAtPageLocation = panzoom.positionElementAtPageLocation;

        /**
         * Sets (or clears) the filter that will be called if the widget needs to know whether to respond to an event that would
         * start a pan. By default, the widget responds to down events on the viewport or the canvas, but not on child nodes. You
         * can supply a function that the widget will call in the event that the down event did not occur on the viewport or the canvas;
         * returning true from this function will cause the pan to begin.
         * @method setFilter
         * @param {Function} filterFn Function to set as the filter; may be null if you wish to clear it. The function should return true if it wants to honour the down event on the given element.
         */
        this.setFilter = panzoom.setFilter;

        /**
         * Appends an element to the viewport so that it floats above the content that is being zoomed and panned.
         * The element will have `position:absolute` set on it. You can float any element you like, but note that the
         * responsibility for setting an appropriate z index is yours.
         * @method floatElement
         * @param {Element} el Element to float.
         * @param {Number[]} pos Array of [x,y] positions.
         */
        this.floatElement = panzoom.floatElement;

        /**
         * Appends an element to the content such that it is zoomed with everything else, but constrains pan
         * in one or both axes so that the element remains fixed with respect to the viewport origin.
         * @method fixElement
         * @param {Element} el The DOM element to append.
         * @param {Object} constraints Flags to indicate optional constraint to each axis.
         * @param {Number[]} pos [left,top] location of the element's origin.
         */
        this.fixElement = panzoom.fixElement;

        var _superSetPosition = this.setPosition,
            _superAnimateToPosition = this.animateToPosition,
            _doSetPosition = function(info, x, y) {
                if (info) {
                    panzoom.positionChanged(info.el, [x, y]);
                    self.fire(_e.nodeMoveEnd, {
                        el: info.el,
                        id: info.id,
                        pos: [x, y],
                        node: info.obj,
                        bounds: panzoom.getBoundsInfo()
                    });
                }
            };

        // js doc in superclass
        this.setPosition = function (el, x, y, doNotUpdateElement) {
            var info = _superSetPosition.apply(this, arguments);
            _doSetPosition(info, x, y);
        };

        // js doc in superclass
        this.animateToPosition = function (el, x, y, animateOptions) {
            var info = _superAnimateToPosition.apply(this, arguments);
            _doSetPosition(info, x, y);
        };

        /**
         * Traces the given overlay along either a given path, or the shortest path
         * from a specified `source` to a specified `target` (if such a path exists).
         * If there is no path nothing happens (except for a debug trace, if you have debugging enabled on
         * the Toolkit instance via `toolkit.setDebugEnabled(true)`)
         * @param {Object} params Options for the trace.
         * @param {Path} [params.path] Path to trace.
         * @param {String|Element|Node|Port} [params.source] Source of traversal. May be a Node or Port, or a DOM element or element id. Supply this if you do not supply `path`.
         * @param {String|Element|Node|Port} [params.target] Target of traversal. May be a Node or Port, or a DOM element or element id. Supply this if you do not supply `path`.
         * @param {String|Object} params.overlay This is in the format accepted by the Community edition of jsPlumb.
         * @param {Object} [params.options] Options for animation.
         * @param {Number} [params.options.dwell=250] How long, in milliseconds, to dwell on each node as the overlay traverses the path.
         * @param {Number} [params.options.speed=100] How many pixels per second to travel. *Note*: this is in seconds, not milliseconds.
         * @param {Number} [params.options.rate=30] Frame rate, in milliseconds.
         * @returns {Boolean} True if the path existed and was traced. False otherwise.
         */
        this.tracePath = function(params) {
            var path = params.path || (function() {
                var source = _super.getObjectInfo(params.source);
                var target = _super.getObjectInfo(params.target);
                return _super.toolkit.getPath({source: source, target: target});
            })();

            if (path.exists()) {
                var fire = function (event, connection) {
                        this.fire(event, { edge: connection.edge, connection: connection, options: params.options });
                    }.bind(this),
                    components = [], currentConn = null, previousConn = null,
                    pathLength = path.path.path.length;

                for (var i = 1; i < pathLength; i++) {

                    var thisVertexId = path.path.path[i].vertex.id,
                        previousVertex = path.path.previous[thisVertexId],
                        forwards = true,
                        thisEdge = path.path.path[i].edge;

                    // if previous vertex not null, ensure that it is the SOURCE of
                    // the edge. if it is not, then we need to traverse this edge
                    // in the opposite to its natural flow.
                    if (previousVertex != null) {
                        forwards = previousVertex === thisEdge.source;
                    }

                    currentConn = _super.getConnectionForEdge(thisEdge);
                    previousConn = currentConn.animateOverlay(params.overlay,
                        jsPlumb.extend(params.options || {}, {
                            previous: previousConn,
                            isFinal: i === pathLength - 1,
                            forwards: forwards
                        }));

                    components.push({handler: previousConn, connection: currentConn});
                }

                if (components.length > 0) {
                    components[0].handler.bind(jsPlumbToolkit.Events.startOverlayAnimation, function () {
                        fire(jsPlumbToolkit.Events.startOverlayAnimation, components[0].connection);
                    });
                    components[components.length - 1].handler.bind(jsPlumbToolkit.Events.endOverlayAnimation, function () {
                        fire(jsPlumbToolkit.Events.endOverlayAnimation, components[components.length - 1].connection);
                    });
                }

                return true;
            }
            else {
                if (_super.toolkit.isDebugEnabled()) {
                    jsPlumbUtil.log("Cannot trace non existent path");
                }

                return false;
            }

        };

        /**
         * Returns a map of element ids -> positions.
         * @return {Object} Map of { id->[x,y]} positions.
         */
        this.getNodePositions = function () {
            var out = {};
            var ep = panzoom.getElementPositions();
            for (var i in ep) {
                var n = _super.getNodeForElementId(i);
                out[n.id] = [ ep[i][0][0], ep[i][0][1] ];
            }
            return out;
        };

        //
        // Append an element to the surface. Not part of the public API, unless being used via a layout
        // decorator. But the decorator does not know it is talking to a Surface.
        // Pos is a {left:, top:} object. It gets converted to an Array for the PanZoom widget.
        //
        this.append = function (el, id, pos, isDecoration) {
            canvasElement.appendChild(el);
            if (pos) {
                pos = [ pos.left, pos.top ];
            }
            panzoom.add(el, id, pos, isDecoration);
        };

        var _setLayoutParent = this.setLayout;
        this.setLayout = function (l, doNotRefresh) {
            _setLayoutParent(l, doNotRefresh);
            if (miniview) {
                miniview.setHostLayout(this.getLayout());
            }
        };

// -------------------- event delegation - click, dblclick etc ----------------------------------------------------------------

        var _delegateOne = function (evt) {
            //_super.jsPlumb.on(canvasElement, evt, "*", function(e) {
            _super.jsPlumb.on(canvasElement, evt, ".jtk-node, .jtk-node *", function (e) {
                var t = e.srcElement || e.target;
                if (t == null) {
                    e = JP.getOriginalEvent(e);
                    t = e.srcElement || e.target;
                }

                if (t != null && t.jtk) {
                    var args = JP.extend({e: e, el: t}, t.jtk);
                    self.fire(evt, args, e);
                }
            });
        };

        for (var i = 0; i < exports.mouseEvents.length; i++) {
            _delegateOne(exports.mouseEvents[i]);
        }

// -------------------- / event delegation - click, dblclick etc ----------------------------------------------------------------


// ------------------------------ node selection/deselection --------------------------------------
        _super.toolkit.bind(_c.select, function (d) {
            if (d.obj.objectType == _c.nodeType) {
                var el = _super.getElement(d.obj.id);
                if (el) {
                    jsPlumb.addClass(el, _cl.SURFACE_SELECTED_ELEMENT);
                    _super.jsPlumb.addToDragSelection && _super.jsPlumb.addToDragSelection(el);
                }
            }
            else if (d.obj.objectType == _c.edgeType) {
                var conn = _super.getConnectionForEdge(d.obj);
                if (conn) {
                    conn.addClass(_cl.SURFACE_SELECTED_CONNECTION);
                }
            }
        });

        _super.toolkit.bind(_e.selectionCleared, function () {
            _super.jsPlumb.clearDragSelection && _super.jsPlumb.clearDragSelection();
            jsPlumb.removeClass($j("." + _cl.SURFACE_SELECTED_CONNECTION), _cl.SURFACE_SELECTED_CONNECTION);
            jsPlumb.removeClass($j("." + _cl.SURFACE_SELECTED_ELEMENT), _cl.SURFACE_SELECTED_ELEMENT);
        });

        _super.toolkit.bind(_e.deselect, function (d) {
            if (d.obj.objectType == _c.nodeType) {
                var el = _super.getElement(d.obj.id);
                if (el) {
                    jsPlumb.removeClass(el, _cl.SURFACE_SELECTED_ELEMENT);
                    _super.jsPlumb.removeFromDragSelection && _super.jsPlumb.removeFromDragSelection(el);
                }
            }
            else if (d.obj.objectType == _c.edgeType) {
                var conn = _super.getConnectionForEdge(d.obj);
                if (conn) {
                    conn.removeClass(_cl.SURFACE_SELECTED_CONNECTION);
                }
            }
        });

        var so = this.setOffset;
        this.setOffset = function (el, o) {
            so.apply(this, arguments);
            panzoom.positionChanged(el, [o.left, o.top]);
        };

        var sap = this.setAbsolutePosition;
        this.setAbsolutePosition = function (el, xy, onComplete) {
            sap.call(this, el, xy);
            // inform panzoom the position has changed.
            panzoom.positionChanged(el, xy);
            _super.jsPlumb.revalidate(el);
            // run the onComplete function if necessary
            if (onComplete)
                onComplete();
        };

        /**
         * Sets the current mode - "pan", "select" or "disabled", then fires an event notifying any listeners subscribed to the `modeChanged` event.
         * @method setMode
         * @param {String} mode Mode to set. Must be one of Surface.PAN, Surface.SELECT or Surface.DISABLED.
         * @param {Boolean} [doNotClearSelection=false] By default, when switching _into_ Select mode, the current selection is cleared. Setting this to false prevents the selection from being cleared.
         */
        this.setMode = function (mode, doNotClearSelection, options) {
            if (modes[mode]) {
                _mode = mode;
                modes[mode]();

                if (mode === _c.select && !doNotClearSelection) {
                    // clear existing selection
                    _super.toolkit.clearSelection();
                }

                if (options && mode === _c.select) {
                    if (options.lassoSelectionFilter) lassoSelectionFilter = options.lassoSelectionFilter;
                }

                self.fire(_e.modeChanged, mode);
            }
            else {
                throw new TypeError("Surface: unknown mode '" + mode + "'");
            }
        };

        var _selectEdges = function (params, edgeSelectFunction) {
            var p = jsPlumb.extend({}, params);
            p.source = _super.getObjectInfo(params.source).obj;
            p.target = _super.getObjectInfo(params.target).obj;
            p.element = _super.getObjectInfo(params.element).obj;
            var edges = _super.toolkit[edgeSelectFunction](p),
                connections = _super.getConnectionsForEdges(edges);
            return _super.jsPlumb.select({connections: connections});
        };

        /**
         * Selects a set of edges. If you supply a DOM element for any of the arguments here, the underlying graph object - a Node or a Port - will be
         * determined, and the edges for that object will be retrieved.  Note that for a Port this method does the same thing as
         * `selectAllEdges`, but for a Node, which may have Ports registered on it, this method will retrieve only the Edges directly
         * registered on the Node itself.  You may need to use `selectAllEdges` if you want everything from some Node.
         * @method selectEdges
         * @param {Object} params Selection parameters
         * @param {String|Element|Node|Selector} [params.source]  Source node, as a Node, a DOM element, a selector, or a String (including support for wildcard '*')
         * @param {String|Element|Node|Selector} [params.target]  Target node, as a Node, a DOM element, a selector, or a String (including support for wildcard '*')
         * @param {String|Element|Node|Selector} [params.element] Source or target node, as a Node, a DOM element, a selector, or a String (including support for wildcard '*')
         */
        this.selectEdges = function (params) {
            return _selectEdges(params, "getEdges");
        };

        /**
         * Selects a set of Edges.  Parameters are the same as for selectEdges; the difference here is that when you're working with
         * Nodes, this method will return all of the Node's Edges as well as those of all the Ports registered on the Node.
         * @method selectAllEdges
         * @param {Object} params Selection parameters
         * @param {String|Element|Node|Selector} [params.source]  Source node, as a Node, a DOM element, a selector, or a String (including support for wildcard '*')
         * @param {String|Element|Node|Selector} [params.target]  Target node, as a Node, a DOM element, a selector, or a String (including support for wildcard '*')
         * @param {String|Element|Node|Selector} [params.element] Source or target node, as a Node, a DOM element, a selector, or a String (including support for wildcard '*')
         *
         */
        this.selectAllEdges = function (params) {
            return _selectEdges(params, "getAllEdges");
        };

        /**
         * Repaints the element for the given object.
         * @method repaint
         * @param {String|Port|Node|Element|Selector} obj Object to repaint, including any associated connections. This can be
         * a Toolkit Node or Port, a String (representing a Node or Node.Port id), a DOM element, or a selector from the support library
         * modelling a DOM element.
         */
        this.repaint = function (obj) {
            var info = _super.getObjectInfo(obj);
            if (info.el) {
                _super.jsPlumb.recalculateOffsets(info.el);
                _super.jsPlumb.revalidate(_super.jsPlumb.getId(info.el));
                self.fire(_e.objectRepainted, info);
            }
        };

        /**
         * Repaints every element in the UI.
         * @method repaintEverything
         */
        this.repaintEverything = _super.jsPlumb.repaintEverything;

        /**
         * Sets whether or not elements will be made draggable. This does not disable dragging on elements
         * that are already draggable.
         * @method setElementsDraggable
         * @param {Boolean} d If false, elements will not be made draggable. If null or true, they will.
         */
        this.setElementsDraggable = function (d) {
            elementsDraggable = d !== false;
        };

        var _droppablesHandler = function (droppableParams) {
            if (!droppableParams || (!droppableParams.droppables && !(droppableParams.source && droppableParams.selector) && (droppableParams.allowNative !== true))) throw new TypeError("Cannot configure droppables: you must specify either `droppables`, `source` + `selector` or `allowNative:true`");

            var dataGenerator = droppableParams.dataGenerator || function () { return { }; },
                typeExtractor = droppableParams.typeExtractor,
                locationSetter = droppableParams.locationSetter || function (left, top, data) {
                    data.left = left;
                    data.top = top;
                },
                i,
                droppables = droppableParams.droppables ? droppableParams.droppables :
                             droppableParams.source ? droppableParams.source.querySelectorAll(droppableParams.selector) :
                             [],
                dragOptions = droppableParams.dragOptions || {},
                dropOptions = droppableParams.dropOptions || {},
                scope = "scope_" + (new Date()).getTime(),
                drop = function (e, ui, native) {
                    var cont = true;
                    if (droppableParams.drop) {
                        cont = droppableParams.drop.apply(this, arguments) !== false;
                    }
                    if (cont) {
                        var dragObject = _super.jsPlumb.getDragObject(arguments),
                            dragObjectLocation = self.getJsPlumb().getOffset(native ? nativeDragPlaceholder : dragObject, true),
                            eventLocation = panzoom.mapLocation(dragObjectLocation.left, dragObjectLocation.top),
                            type = typeExtractor ? typeExtractor(dragObject, e, native, eventLocation) : null,
                            data = dataGenerator ? dataGenerator(type, dragObject, e, eventLocation) : {};

                        data = data || {}; // allow data generator to pass back null.

                        if (type != null)
                            data.type = type;

                        locationSetter(eventLocation.left, eventLocation.top, data);
                        _super.toolkit.getNodeFactory()(type, data, function (n) {
                            // second arg will be passed through by the Toolkit to registered listeners, ie.
                            // the Surface and its layout. This will probably supersede `locationSetter`.
                            var droppedNode = _super.toolkit.addNode(n, { position: eventLocation });
                            droppableParams.onDrop && droppableParams.onDrop(droppedNode, e, eventLocation);

                        }, e, native);
                    }
                },
                startEv = JP.dragEvents[_c.start],
                dragEv = JP.dragEvents[_c.drag],
                stopEv = JP.dragEvents[_c.stop],
                dropEv = JP.dragEvents[_c.drop],
                devNull = function () {
                },
                nativeFilter = droppableParams.nativeFilter || [],
                allowNative = droppableParams.allowNative,
                nativeFilterMap = {};

            dragOptions[startEv] = JUTIL.wrap(dragOptions[startEv], droppableParams.start || devNull);
            dragOptions[dragEv] = JUTIL.wrap(dragOptions[dragEv], droppableParams.drag || devNull);
            dragOptions[stopEv] = JUTIL.wrap(dragOptions[stopEv], droppableParams.stop || devNull);

            dropOptions.scope = scope;
            dropOptions[dropEv] = JUTIL.wrap(dropOptions[dropEv], drop);

// NATIVE
            if (allowNative) {
                var nativeDragPlaceholder = document.createElement(_c.div);
                nativeDragPlaceholder.style.position = _c.absolute;
                for (i = 0; i < nativeFilter.length; i++) {
                    nativeFilterMap[nativeFilter[i]] = true;
                }

                var _filterNative = function (e) {
                    if (e.dataTransfer != null && e.dataTransfer.items.length === 1) {
                        return (nativeFilter.length == 0 || nativeFilterMap[e.dataTransfer.items[0].type]);
                    }
                    return false;
                };

                document.addEventListener(_e.dragover, function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (_filterNative(e)) {
                        jsPlumb.setAbsolutePosition(nativeDragPlaceholder, [ e.pageX, e.pageY ]);
                        dragOptions[dragEv].apply(null, [ e, {
                            helper: nativeDragPlaceholder,
                            offset: { left: e.pageX, top: e.pageY }
                        }, true ]);
                    }
                }, false);

                document.addEventListener(_e.drop, function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (_filterNative(e)) {
                        dropOptions[dropEv].apply(null, [ e, {
                            helper: nativeDragPlaceholder,
                            offset: { left: e.pageX, top: e.pageY }
                        }, true ]);
                        dragOptions[stopEv].apply(null);
                    }
                }, false);

                document.addEventListener(_e.dragend, function (e) { });
            }

// / NATIVE

            _super.jsPlumb.initDroppable(containerElement, dropOptions, _c.surfaceNodeDragScope);

            function _oneDraggable(droppableNode) {
                if (!_super.jsPlumb.hasClass(droppableNode, _cl.SURFACE_DROPPABLE_NODE)) {
                    _super.jsPlumb.addClass(droppableNode, _cl.SURFACE_DROPPABLE_NODE);
                    _super.jsPlumb.initDraggable(droppableNode, dragOptions, _c.surfaceNodeDragScope, _super.jsPlumb);
                }
            }

            dragOptions.scope = scope;
            dragOptions.ignoreZoom = true; // draggables should not be subject to the zoom in place for UI elements.
            dragOptions.doNotRemoveHelper = true;
            for (i = 0; i < droppables.length; i++) {
                var droppableNode = _super.jsPlumb.getElement(droppables[i]);
                _oneDraggable(droppableNode);
            }

            return {
                refresh:function() {
                    if (!(droppableParams.source && droppableParams.selector)) {
                        throw new TypeError("Cannot refresh droppables; `source` and `selector` required in constructor.")
                    }
                    else {
                        var d = droppableParams.source.querySelectorAll(droppableParams.selector);
                        for (var i = 0; i < d.length; i++) {
                            _oneDraggable(d[i]);
                        }
                    }
                }
            }
        };

        /**
         * Allows you to register a list of droppables that can be dropped onto the surface. This function also supports
         * configuring the Surface to accept files dragged from the user's desktop, but it is limited to supporting one file
         * at a time.
         * @method registerDroppableNodes
         * @param {Object} params Parameters for droppables, including node list, drop options etc
         * @param {Function} [params.typeExtractor] Optional function to use to extract the related node type for some element that was dropped on the Surface.
         * @param {Function} [params.dataGenerator] Optional function to use to generate some initial data for a node of some given type. The function is passed `type` as argument, which _may be null_, so program defensively.
         * @param {Element[]} [params.droppables] List of elements identifying the elements to be configured as droppable. Either provide this,
         * or provide `source` and `selector`. It is only in this latter case that you will be able to call `refresh` to
         * subsequently add newly added elements to the set of droppables.
         * @param {Element} [params.source] Source element on which to execute `querySelectorAll` with the given `selector`
         * in order to get the list of elements to be configured as droppable.
         * @param {Element} [params.selector] Selector that specifies child nodes of `source` that should be configured as droppable.
         * @param {Object} [params.dragOptions] Optional set of drag options, in a format specific to your underlying library.
         * @param {Object} [params.dropOptions] Optional set of drop options, in a format specific to your underlying library.
         * @param {Function} [params.start] Function to call when a droppable starts to be dragged.
         * @param {Function} [params.drag] Function to call as a droppable is being dragged.
         * @param {Function} [params.stop] Function to call when a droppable stops being dragged.
         * @param {Function} [params.drop] Function to call when a droppable has been dropped, *before* the Toolkit code is run. Returning false from this function causes the drop to be aborted.
         */
        this.registerDroppableNodes = function (params) {
            return new _droppablesHandler(params);
        };

        // ************** miniview ********************************
        /**
         * Creates a miniview that is associated with this Surface.
         * @method createMiniview
         * @param {Object} params Miniview parameters. See Minview docs.
         */
        this.createMiniview = function (params) {

            // do not re-init an element that is already a miniview.
            if (miniview != null) {
                var containerId = _super.jsPlumb.getId(_super.jsPlumb.getElement(params.container));
                if (miniview.getContainerId() == containerId)
                    return false;
                // else ? cleanup the current miniview? or will garbage collection do that.
            }

            var p = JP.extend({
                surface: self,
                toolkit: _super.toolkit,
                surfaceContainerElement: containerElement,
                bounds: panzoom.getBoundsInfo(),
                visible: params.initiallyVisible !== false || _super.toolkit.getNodeCount() > 0,
                layout: {
                    type: _c.mistletoeLayoutType,
                    parameters: {
                        layout: self.getLayout()
                    }
                }
            }, params);
            miniview = new JTK.Renderers.Miniview(p);

            // register existing nodes.
            for (var n in _super.nodeMap) {
                var el = _super.nodeMap[n];
                miniview.registerNode({el: el, node: el.jtk.node, pos: jsPlumb.getAbsolutePosition(el) });
            }

            return miniview;
        };
        if (params.miniview) {
            this.createMiniview(params.miniview);
        }

        /**
         * Gets the current Miniview, if there is one. There may not be.
         * @method getMiniview
         * @return {Miniview} Current Miniview, null if no Miniview is registered.
         */
        this.getMiniview = function () {
            return miniview;
        };


        // ******************************* save/restore UI state (from either cookies or html5 storage, depending on the browser )

        this.State = {
            /**
             * Writes the current location of each node in the UI to local storage (using either a cookie or html5 storage,
             * depending on browser capabilities). You pass this function a 'handle' argument, which is used to restore the state
             * at some stage in the future.
             * @method State.save
             * @param {String} [handle] The handle to save the state as, If this is not supplied, and `stateHandle` was supplied as a constructor parameter, that is used instead.
             * @param {Function} [preprocessor] Optional preprocessor which is given the serialized state, and a callback function, before saving to localStorage. Useful if you wish to compress the data, for instance.
             */
            save: function (handle, preprocessor) {
                handle = arguments.length == 2 ? arguments[0] : arguments.length == 1 && typeof arguments[0] === "string" ? arguments[0] : stateHandle;
                preprocessor = arguments.length == 2 ? arguments[1] : arguments.length == 1 && typeof arguments[0] === "function" ? arguments[0] : function(s, f) { return f(s); };
                if (handle) {
                    try {
                        preprocessor(self.State.serialize(), function(_s) {
                            JTK.util.Storage.set(_c.jtkStatePrefix + handle, _s);
                        });
                    }
                    catch (e) {
                        JUTIL.log(_cl.msgCannotSaveState, e);
                    }
                }
            },
            /**
             * Serializes the UI state to a String.
             * @method State.serialize
             */
            serialize : function() {
                var o = panzoom.getPan();
                o.push(panzoom.getZoom());
                o.push.apply(o, panzoom.getTransformOrigin());
                var s = o.join(",");

                // elements.
                var p = self.getLayout().getPositions(), _p = [];
                for (var i in p) {
                    _p.push(i + " " + p[i][0] + " " + p[i][1]);
                }

                s += ("," + _p.join("|"));

                return s;
            },
            /**
             * Restores the UI state to the state it was in when it was saved with the given handle. If the handle does not
             * exist, nothing happens. It is possible a future incarnation of this could support animating a UI back to some state.
             * @method State.restore
             * @param {String} [handle] The handle to restore the state from, If this is not supplied, and `stateHandle` was supplied as a constructor parameter, that is used instead.
             * @param {Function} [preprocessor] Optional preprocessor which is given the serialized state before saving to localStorage. Useful if you wish to compress the data, for instance.
             */
            restore: function (handle, preprocessor) {
                handle = arguments.length == 2 ? arguments[0] : arguments.length == 1 && typeof arguments[0] === "string" ? arguments[0] : stateHandle;
                preprocessor = arguments.length == 2 ? arguments[1] : arguments.length == 1 && typeof arguments[0] === "function" ? arguments[0] : function(s, f) { return f(s); };

                if (handle) {
                    try {
                        var s = JTK.util.Storage.get(_c.jtkStatePrefix + handle);
                        if (s) {
                            preprocessor(s, self.State.deserialize);
                        }
                    }
                    catch (e) {
                        JUTIL.log(_cl.msgCannotRestoreState, e);
                    }
                }
            },
            /**
             * Restores the UI state to the serialized state given.
             * @method State.deserialize
             * @param {String} value Serialized state.
             */
            deserialize:function(value) {
                var _s = value.split(",");
                //panzoom.setPan(parseFloat(_s[0]), parseFloat(_s[1]));
                //panzoom.setZoom(parseFloat(_s[2]));
                //panzoom.setTransformOrigin(parseFloat(_s[3]), parseFloat(_s[4]));
                var p = _s[5].split("|"), l = self.getLayout();
                for (var i = 0; i < p.length; i++) {
                    var _p = p[i].split(" ");
                    try {
                        self.setPosition(_p[0], parseFloat(_p[1]), parseFloat(_p[2]));
                    }
                    catch (e) {
                        // consume. non fatal and we dont want to clog up the console.
                    }
                }

                l.draw();
            },
            /**
             * Clears the state that was stored against the given handle.
             * @method State.clear
             */
            clear: function (handle) {
                handle = handle || stateHandle;
                if (handle) {
                    JTK.util.Storage.clear(_c.jtkStatePrefix + handle);
                }
            },
            /**
             * Removes all saved UI state information.
             * @method State.clearAll
             */
            clearAll: function () {
                JTK.util.Storage.clearAll();
            }
        };

        /**
         * Saves the current state of the UI, either to local storage or a cookie, depending on the browser's capabilities.
         * @method saveState
         * @param {String} handle The handle to save the state as, If this is not supplied, and `stateHandle` was supplied as a constructor parameter, that is used instead.
         */
        self.saveState = self.State.save;

        self.store = JTK.util.Storage.set;
        self.retrieve = JTK.util.Storage.get;
        self.storeJSON = JTK.util.Storage.setJSON;
        self.retrieveJSON = JTK.util.Storage.getJSON;

        /**
         * Restores the current state of the UI, either from local storage or a cookie, depending on the browser's capabilities.
         * @method restoreState
         * @param {String} handle The handle to restore the state from, If this is not supplied, and `stateHandle` was supplied as a constructor parameter, that is used instead.
         */
        self.restoreState = function (handle) {
            self.State.restore(handle);
            self.getJsPlumb().repaintEverything();
            self.fire(_e.stateRestored);
        };

        /**
         * Clears the state stored by the given handle.
         * @method clearState
         * @param {String} handle The handle to restore the state from. If this is not supplied, and `stateHandle` was supplied as a constructor parameter, that is used instead.
         */
        self.clearState = function (handle) {
            self.state.clear(handle);
        };

        // ******************************* end of save/restore UI state (from either cookies or html5 storage, depending on the browser )

        // finally, initialize
        self.initialize();

        // prefer zoomToFitIfNecessary if it is set:
        if (params.zoomToFitIfNecessary)
            self.zoomToFitIfNecessary();
        // but if zoomToFit is set, do that.
        else if (params.zoomToFit)
            self.zoomToFit();
    };


    // register the Surface as the default renderer type for the Toolkit.  If the Toolkit is being used
    // server-side, this script will not have been included and so this won't be set.
    JTK.DefaultRendererType = _c.surfaceType;


}).call(this);

/**
 * The Miniview widget. A single instance of this is paired with an instance of Surface.
 *
 * The fundamental difference between this and a Surface is that a Miniview does not draw connections. Plus, it
 * calculates its own zoom based on the ratio of the size of its viewport compared to the size of the viewport of
 * the related Surface. In reality, a Miniview could reside inside an element that is much bigger than that in which
 * the related Surface resides, but it does not seem likely that that would normally be the case.
 *
 * The Miniview widget provides a floating window that represents a scaled version of the viewport of the related
 * Surface. Dragging this window around causes the related Surface to pan.  Resizing (via grabbing a corner and
 * dragging) the window causes the Surface to zoom in/out (within its allowed zoom range).
 *
 * All of the visual aspects of the Miniview can be controlled via CSS, and you can provide a custom CSS class
 * to allow you to target the styles for an individual Miniview more easily.
 *
 * You do not create a Miniview directly - you either specify its parameters in a `render` call on a `jsPlumbToolkitInstance`,
 * or you call `createMiniview` on an existing `Surface`.
 *
 * @class jsPlumbToolkit.Renderers.Miniview
 * @constructorg
 */
;
(function () {

    "use strict";

    var root = this;
    var JTK = root.jsPlumbToolkit,
        exports = JTK.Renderers,
        JUTIL = jsPlumbUtil,
        JP = jsPlumb,
        _cl = jsPlumbToolkit.Classes,
        _c = jsPlumbToolkit.Constants,
        _e = jsPlumbToolkit.Events,
        _a = jsPlumbToolkit.Attributes,
        _m = jsPlumbToolkit.Methods;

    exports.Miniview = function (params) {
        this.bindToolkitEvents = false;
        var _super = exports.AbstractRenderer.apply(this, arguments), self = this;

        exports.DOMElementAdapter.apply(this, arguments);

        var surface = params.surface,
            containerElement = JP.getElement(params.container),
            canvasElement = exports.createElement({ position: _c.relative, width: _c.nominalSize, height: _c.nominalSize, left: 0, top: 0, clazz: _cl.MINIVIEW_CANVAS }, containerElement),
            pannerElement = exports.createElement({ position: _c.absolute, width: _c.nominalSize, height: _c.nominalSize, left: 0, top: 0, clazz: _cl.MINIVIEW_PANNER }, containerElement),
            surfaceBounds = params.bounds,
            suspended = params.suspended === true,
            _collapsible = params.collapsible !== false,
            _collapser = null,
            _collapsed = false,
            wheelSensitivity = params.wheelSensitivity || 10,
            panzoom = new ZoomWidget({
                viewport: containerElement,
                canvas: canvasElement,
                domElement: JP.getElement,
                offset: this.getOffset,
                bind: function () {
                    _super.jsPlumb.on.apply(_super.jsPlumb, arguments);
                },
                unbind: function () {
                    _super.jsPlumb.off.apply(_super.jsPlumb, arguments);
                },
                enableWheelZoom: false,
                enablePanButtons: false,
                enablePan: false,
                enableAnimation:false,
                width: function (el) {
                    return _super.jsPlumb.getWidth(_super.jsPlumb.getElement(el))
                },
                height: function (el) {
                    return _super.jsPlumb.getHeight(_super.jsPlumb.getElement(el))
                },
                id: _super.jsPlumb.getId,
                animate: _super.jsPlumb.animate,
                dragEvents: {
                    "stop": JP.dragEvents[_c.stop],
                    "start": JP.dragEvents[_c.start],
                    "drag": JP.dragEvents[_c.drag]
                },
                extend: JP.extend,
                events: {
                    pan: function () {
                        _updateSurface();
                    },
                    mousedown: function () {
                        jsPlumb.addClass(pannerElement, _cl.MINIVIEW_PANNING);
                    },
                    mouseup: function () {
                        jsPlumb.removeClass(pannerElement, _cl.MINIVIEW_PANNING);
                    }
                },
                zoomRange: [ -Infinity, Infinity ]
            }),
            panning = false, downAt = null, pannerAtMouseDown = null, zoomingWithWheel = false,
            _downListener = function (e) {
                panning = true;
                downAt = panzoom.pageLocation(e);
                pannerAtMouseDown = jsPlumb.getAbsolutePosition(pannerElement);
                JP.on(document, _e.mouseup, _upListener);
                JP.on(document, _e.mousemove, _moveListener);
                JUTIL.consume(e);
            },
            _moveListener = function (e) {
                zoomingWithWheel = false;
                if (panning) {
                    var loc = panzoom.pageLocation(e),
                        dx = loc[0] - downAt[0],
                        dy = loc[1] - downAt[1],
                        newPannerPos = [pannerAtMouseDown[0] + dx, pannerAtMouseDown[1] + dy];

                    var clampedMovement = _updateSurface(newPannerPos);
                    jsPlumb.setAbsolutePosition(pannerElement, newPannerPos);
                }
            },
            _upListener = function (e) {
                panning = false;
                downAt = null;
                JP.off(document, _e.mouseup, _upListener);
                JP.off(document, _e.mousemove, _moveListener);
            },
            visible = true,
            pannerPos;

        var wheelZoom = function (e) {
            JUTIL.consume(e);
            surface.nudgeWheelZoom(e.normalizedWheelDelta * wheelSensitivity, e);
        };

        // bind to window resize, debounced.
        JP.on(window, _e.resize, jsPlumbToolkitUtil.debounce(function() {
            _updatePanner();
        }, 100));

        // bind mousewheel
        if (params.enableWheelZoom !== false) {
            addWheelListener(containerElement, wheelZoom);
        }

        // panzoom offers a helper method to do this for us.
        panzoom.setTransformOriginForElement(pannerElement, [0, 0]);

        // add jtk-miniview class to container
        jsPlumb.addClass(containerElement, _cl.MINIVIEW);

        // configure pannerElement
        JP.on(pannerElement, _e.mousedown, _downListener);

        // if collapsible, add the collapser.
        if (_collapsible) {
            _collapser = jsPlumb.createElement("div");
            _collapser.className = _cl.MINIVIEW_COLLAPSE;
            containerElement.appendChild(_collapser);
            JP.on(_collapser, _c.click, function (e) {
                _collapsed = !_collapsed;
                jsPlumb[_collapsed ? _m.addClass : _m.removeClass](containerElement, _cl.MINIVIEW_COLLAPSED);
            });
        }

        var _zoomToFit = function (doNotFirePanEvent) {
            panzoom.zoomToFit({
                onComplete: _updatePanner,
                onStep: _updatePanner,
                doNotFirePanEvent: doNotFirePanEvent
            });
        };

        params.toolkit.bind(_e.dataLoadEnd, _zoomToFit);

        var _nodeMoved = function (params) {
            surfaceBounds = params.bounds;
            panzoom.positionChanged(params.el, params.pos);
            jsPlumb.setAbsolutePosition(_super.nodeMap[params.node.id], params.pos);
            _zoomToFit(true);
            this.fire(_e.nodeMoveEnd, params);
        }.bind(this);

        var _nodeAdded = function (params) {
            var s = JP.getSize(params.el),
                n = exports.createElement({ position: _c.absolute, width: s[0] + _c.px, height: s[1] + _c.px, left: 0, top: 0, clazz: _cl.MINIVIEW_ELEMENT });

            n.relatedElement = params.el;
            surfaceBounds = surface.getBoundsInfo();
            n.setAttribute(_a.jtkNodeId, params.node.id);
            n.setAttribute(_a.relatedNodeId, params.el.getAttribute(_c.id));
            canvasElement.appendChild(n);
            panzoom.add(n);
            _super.nodeMap[params.node.id] = n;
            self.getLayout().map(params.node.id, n);
            _updatePanner();
        };

        this.registerNode = function (params) {
            _nodeAdded(params);
            _nodeMoved(params);
        };

        var so = this.setOffset;
        this.setOffset = function (el, o) {
            so.apply(this, arguments);
            panzoom.positionChanged(el, [o.left, o.top]);
        };

        var sap = this.setAbsolutePosition;
        this.setAbsolutePosition = function (el, p) {
            sap.call(this, el, p);
            panzoom.positionChanged(el, p);
        };

        /**
         * Sets whether or not the miniview is visible. Strictly speaking you don't need to use this method;
         * you can just control the miniview's container via your own CSS or whatever. But the Surface uses this
         * occasionally, and there is also the concept of having the miniview initially invisible until the
         * related surface contains some data.
         */
        this.setVisible = function (v) {
            visible = v;
            containerElement.style.display = v ? _c.block : _c.none;
        };
        this.setVisible(params.visible !== false);

        /**
         * Gets the current [left,top] of the panned content.
         * @method getPan
         * @return {Number[]} [left,top], in pixels, of the panned content, where [0,0] is the origin of the viewport.
         */
        this.getPan = panzoom.getPan;

        var _objectRepainted = function (info) {
            var n = _super.nodeMap[info.id];
            if (n) {
                var s = JP.getSize(n.relatedElement);
                n.style.width = s[0] + _c.px;
                n.style.height = s[1] + _c.px;
                _updatePanner();
            }
        };

        /**
         * Forces a repaint of every element.
         * @method invalidate
         */
        this.invalidate = function(id) {
            if (id) _objectRepainted({id:id});
            else
            {
                for (var i in _super.nodeMap) {
                    _objectRepainted({id: i});
                }
            }
        };

        /**
         * Sets whether or not the miniview is currently suspended, ie. will not respond
         * to changes.
         * @method setSuspended
         * @param {Boolean} s Suspended or not.
         * @param {Boolean} [updateAfterwards] If true, will update the state after changing the suspended state. Only makes sense to use this if you are unsuspending the widget.
         */
        this.setSuspended = function (s, updateAfterwards) {
            suspended = s;
            updateAfterwards && this.update();
        };

        /**
         * Instructs the miniview to update its state.
         * @method update
         */
        this.update = _updatePanner;

        var _nodeRemoved = function (params) {
            var id = params.node, el = _super.nodeMap[id];
            if (el) {
                panzoom.remove(el);
                delete _super.nodeMap[id];
                _super.jsPlumb.removeElement(el);
            }

            // what else?
            if (!params.dontUpdatePanner)
                _updatePanner();
        };

        var _removeAllNodes = function () {
            for (var id in _super.nodeMap)
                _nodeRemoved({node: id, dontUpdatePanner: true});

            _updatePanner();
        };

        // subscribe to the Zoom, Pan and nodeDragEnd events from the Surface.
        surface.bind(_e.pan, _updatePanner);
        surface.bind(_e.zoom, _updatePanner);
        surface.bind(_e.nodeMoveEnd, _nodeMoved);
        surface.bind(_e.nodeRemoved, _nodeRemoved);
        surface.bind(_e.nodeAdded, _nodeAdded);
        surface.bind(_e.nodeRendered, _nodeAdded);
        surface.bind(_e.relayout, _updatePanner);
        surface.bind(_e.objectRepainted, _objectRepainted);
        surface.bind(_e.stateRestored, _updatePanner);
        params.toolkit.bind(_e.graphCleared, _removeAllNodes);

        //
        // bound to the host layout's 'redraw' event.
        //
        var _onLayoutRedraw = function () {
            _zoomToFit(true);
        };

        self.getLayout().bind(_e.redraw, _onLayoutRedraw);

        /**
         * Update the host layout for this miniview
         */
        this.setHostLayout = function (layout) {
            var current = self.getLayout();
            if (current)
                current.setHostLayout(layout);
        };

        function _updatePanner(params) {
            if (surface && panzoom && !suspended) {
                surfaceBounds = surface.getBoundsInfo();
                var scl = surface.getApparentCanvasLocation(),
                    ocl = panzoom.getApparentCanvasLocation(),
                    pz = panzoom.getZoom(),
                    pannerZoom = pz / (surfaceBounds.zoom);

                // size panner to the size of the viewport. we will subsequently scale it.
                pannerElement.style.width = surfaceBounds.vw + _c.px;
                pannerElement.style.height = surfaceBounds.vh + _c.px;
                // scale it
                panzoom.applyZoomToElement(pannerElement, pannerZoom);
                // move it
                var originMappedToPanner = [
                        scl[0] * pannerZoom,
                        scl[1] * pannerZoom
                ];

                pannerPos = [
                        ocl[0] - originMappedToPanner[0],
                        ocl[1] - originMappedToPanner[1]
                ];

                // then show the pannerElement in the appropriate location
                jsPlumb.setAbsolutePosition(pannerElement, pannerPos);
            }
        }

        function _updateSurface(pannerPos) {
            if (panzoom != null) {
                surfaceBounds = surface.getBoundsInfo();
                pannerPos = pannerPos || jsPlumb.getAbsolutePosition(pannerElement);

                var ocl = panzoom.getApparentCanvasLocation(),
                    pz = panzoom.getZoom(),
                    pannerZoom = pz / surfaceBounds.zoom,
                    sx = (ocl[0] - pannerPos[0]) / pannerZoom,
                    sy = (ocl[1] - pannerPos[1]) / pannerZoom;

                var clamped = surface.setApparentCanvasLocation(sx, sy);

                return [
                        ocl[0] - (clamped[0] * pannerZoom),
                        ocl[1] - (clamped[1] * pannerZoom)
                ];
            }
        }

        // this is here for testing; we may not keep it in the API.
        this.setZoom = panzoom.setZoom;
        this.getZoom = panzoom.getZoom;
        this.getTransformOrigin = panzoom.getTransformOrigin;
    };
}).call(this);

;
(function () {

    "use strict";

    var root = this;
    var JTK = root.jsPlumbToolkit;
    var exports = JTK.Widgets;
    var JUTIL = jsPlumbUtil;
    //var ADAPTER = jsPlumbAdapter;

    var oldIE = /MSIE\s([\d.]+)/.test(navigator.userAgent) && (new Number(RegExp.$1)) < 9,
        isTouchDevice = 'ontouchstart' in document.documentElement,
        downEvent = isTouchDevice ? "touchstart" : "mousedown",
        upEvent = isTouchDevice ? "touchend" : "mouseup",
        moveEvent = isTouchDevice ? "touchmove" : "mousemove",
        setSize = function (el, s) {
            el.style.width = s[0] + "px";
            el.style.height = s[1] + "px";
        };

    /**
     * The Lasso widget allows users to select an area with the mouse. You will not typically need to interact with
     * this widget, or create one manually, since the `Surface` widget handles all of that for you.
     * @class jsPlumbToolkit.Widgets.Lasso
     * @constructor
     * @param {Object} params Parameters for the widget.
     * @param {Function} params.pageLocation Function that can return a page location for an event.
     * @param {Element} params.canvas DOM Element on which the Lasso will operate.
     * @param {Function} [params.onStart] Optional function to call at the start of a lasso operation.
     * @param {Function} [params.onEnd] Optional function to call at the end of a lasso operation.
     * @param {Function} [params.onSelect] Optional function to call on each mousemove during a lasso operation.
     * @param {String} [params.filter] Optional CSS selector identifying elements that should be filtered and not begin a lasso operation.
     */
    exports.Lasso = function (params) {
        var canvas = params.canvas,
            enabled = false,
            el = document.createElement("div"),
            origin = [0, 0],
            onStart = params.onStart || function () {
            },
            onEnd = params.onEnd || function () {
            },
            onSelect = params.onSelect || function () {
            },
            down = false,
            downListener = function (e) {
                if (enabled && !filter(e)) {
                    JUTIL.consume(e);
                    down = true;
                    params.on(document, upEvent, upListener);
                    params.on(document, moveEvent, moveListener);
                    params.on(document, "onselectstart", onSelectStartListener);
                    origin = params.pageLocation(e);
                    jsPlumb.setAbsolutePosition(el, origin);
                    setSize(el, [1, 1]);
                    el.style.display = "block";
                    jsPlumb.addClass(document.body, "jtk-lasso-select-defeat");
                    onStart(origin, e.shiftKey);
                }
            },
            moveListener = function (e) {
                if (down) {
                    JUTIL.consume(e);
                    var pl = params.pageLocation(e),
                        s = [ Math.abs(pl[0] - origin[0]), Math.abs(pl[1] - origin[1]) ],
                        o = [Math.min(origin[0], pl[0]), Math.min(origin[1], pl[1])],
                        directions = [ origin[0] < pl[0], origin[1] < pl[1] ];

                    jsPlumb.setAbsolutePosition(el, o);
                    setSize(el, s);
                    onSelect(o, s, [origin[0] < pl[0], origin[1] < pl[1]], e.shiftKey);
                }
            },
            upListener = function (e) {
                if (down) {
                    down = false;
                    JUTIL.consume(e);
                    params.off(document, upEvent, upListener);
                    params.off(document, moveEvent, moveListener);
                    params.off(document, "onselectstart", onSelectStartListener);
                    el.style.display = "none";
                    jsPlumb.removeClass(document.body, "jtk-lasso-select-defeat");
                    onEnd();
                }
            },
            onSelectStartListener = function () {
                return false;
            },
            filter = params.filter ? function (e) {
                var t = e.srcElement || e.target;
                return JUTIL.matchesSelector(t, params.filter);
            } : function () {
                return false;
            };

        el.className = "jtk-lasso";
        document.body.appendChild(el);
        params.on(canvas, downEvent, downListener);

        /**
         * Returns whether or not the lasso is active.
         * @method isActive
         * @return {Boolean} true if active, false otherwise.
         */
        this.isActive = function () {
            return down;
        };

        /**
         * Sets whether or not the lasso responds to mouse events.
         * @method setEnabled
         * @param {Boolean} e Enabled state.
         */
        this.setEnabled = function (e) {
            enabled = e;
        };
    };

}).call(this);
/**
 * jsPlumbToolkit.Dialogs
 *
 * A library for providing simple dialogs to use with an instance of the jsPlumb Toolkit.  This is not packaged in the
 * core Toolkit file and does not form part of any jsPlumb support agreement.
 */
;
(function () {

    "use strict";

    var root = this;

    var cache = {}, current, underlay, overlay, title, content, buttons, onOK, onCancel, onOpen,
        onMaybeClose, onClose,
        btnOk, btnCancel, labels = {
            ok:"OK",
            cancel:"Cancel"
        },
        container = document.body,
        visible = false,
        _rotors = Rotors.newInstance(),
        globals = {},
        reposition = true;

    // create underlay and bind click listener on it (it closes the current dialog)
    jsPlumb.ready(function () {

        underlay = document.createElement("div");
        underlay.className = "jtk-dialog-underlay";

        jsPlumb.on(underlay, "click", function () {
            _close();
        });

        overlay = document.createElement("div");
        overlay.className = "jtk-dialog-overlay";

        title = document.createElement("div");
        title.className = "jtk-dialog-title";
        overlay.appendChild(title);

        content = document.createElement("div");
        content.className = "jtk-dialog-content";
        overlay.appendChild(content);

        buttons = document.createElement("div");
        buttons.className = "jtk-dialog-buttons";
        overlay.appendChild(buttons);
    });

    var _createButtons = function() {
        btnOk = document.createElement("button");
        btnOk.className = "jtk-dialog-button jtk-dialog-button-ok";
        btnOk.innerHTML = labels.ok;
        buttons.appendChild(btnOk);
        jsPlumb.on(btnOk, "click", function () {
            _close();
        });

        btnCancel = document.createElement("button");
        btnCancel.className = "jtk-dialog-button jtk-dialog-button-cancel";
        btnCancel.innerHTML = labels.cancel;
        buttons.appendChild(btnCancel);
        jsPlumb.on(btnCancel, "click", function () {
            _close(true);
        });
    };

    var _positioners = {
        x:function(docElem, isBody, s) {
            var dw = container.clientWidth, l = (dw - s[0]) / 2;
            var scrollLeft = window.pageXOffset || docElem.scrollLeft || document.body.scrollLeft;
            if (l < 0) l = 10;
            scrollLeft = isBody ? scrollLeft : container.scrollLeft;
            overlay.style.left = l + scrollLeft + "px";
        },
        y:function(docElem, isBody, s) {
            var dh = container.clientHeight, t = 0.1 * dh;
            var scrollTop = window.pageYOffset || docElem.scrollTop || document.body.scrollTop;
            if (t < 0) t = 10;
            scrollTop = isBody ? scrollTop : container.scrollTop;
            overlay.style.top = t + scrollTop + "px";
        }
    };

    var _positionOverlay = function () {
        if (visible) {
            var docElem = document.documentElement,
                s = jsPlumb.getSize(overlay),
                isBody = container == document.body,
                axis = overlay.getAttribute("data-axis");

            underlay.style.position = isBody ? "fixed" : "absolute";
            _positioners[axis](docElem, isBody, s);
        }
    };

    var keyListener = function (e) {
        if (e.keyCode == 27)
            _close(true);
    };

    var _resolveContainer = function (c) {
        if (c == null) return document.body;
        else if (typeof c === "string")
            return document.getElementById(c);
        else
            return c;
    };

    // set the current dialog
    var _setCurrent = function (params) {
        if (!params.id || !cache[params.id]) return;

        reposition = params.reposition !== false;
        onOK = params.onOK;
        onCancel = params.onCancel;
        onOpen = params.onOpen;
        onMaybeClose = params.onMaybeClose;
        onClose = params.onClose;

        var position = params.position || "top",
            positionClass = "jtk-dialog-overlay-" + position,
            axis = (position === "top" || position === "bottom" ? "x" : "y"),
            axisClass = "jtk-dialog-overlay-" + axis;

        _createButtons();

        // set labels:
        btnOk.innerHTML = params.labels ? params.labels.ok || labels.ok : labels.ok;
        btnCancel.innerHTML = params.labels ? params.labels.cancel || labels.cancel : labels.cancel;

        container = _resolveContainer(params.container);

        var d = params.data || {}, t = _rotors.template(params.id, d);

        title.innerHTML = params.title || cache[params.id].title || "";
        content.innerHTML = "";
        var childNodeCount = t.childNodes.length;
        for (var i = 0; i < childNodeCount; i++)
            content.appendChild(t.childNodes[0]);

        container.appendChild(underlay);
        container.appendChild(overlay);

        jsPlumb.addClass(overlay, positionClass);
        jsPlumb.addClass(overlay, axisClass);

        underlay.style.display = "block";
        overlay.style.display = "block";
        overlay.setAttribute("data-position", position);
        overlay.setAttribute("data-axis", axis);

        // hide/show cancel button
        btnCancel.style.visibility = cache[params.id].cancelable ? "visible" : "hidden";

        visible = true;
        _positionOverlay();
        _setData(d);

        globals.onOpen && globals.onOpen(overlay);
        onOpen && onOpen(overlay);
        jsPlumb.addClass(overlay, "jtk-dialog-overlay-visible");

        jsPlumb.on(document, "keyup", keyListener);
        // on window resize/scroll, ensure dialog stays in the middle.
        if (reposition) {
            jsPlumb.on(window, "resize", _positionOverlay);
            jsPlumb.on(window, "scroll", _positionOverlay);
        }

        // attach a clear button/clear all button handler
        jsPlumb.on(overlay, "click", "[jtk-clear]", function(e) {
            var a = this.getAttribute("jtk-att");
            if (a) {
                _clear(overlay.querySelectorAll("[jtk-att='" + a + "']:not([jtk-clear])"), this);
            }
        });

        jsPlumb.on(overlay, "click", "[jtk-clear-all]", function(e) {
            _clear(overlay.querySelectorAll("[jtk-att]:not([jtk-clear])"), this);
        });

        // perhaps set the focus
        try {
            var focusNode = content.querySelector("[jtk-focus]");
            focusNode && setTimeout(function () {
                focusNode.focus();
            }, 0);
        }
        catch (e) {
        } // old IE throws error if you try to focus a hidden el. so this is just in case.
    };

    var _setData = function (data) {
        var atts = content.querySelectorAll("[jtk-att]");
        for (var i = 0; i < atts.length; i++) {
            var t = atts[i].tagName.toUpperCase(),
                tt = t === "INPUT" ? (atts[i].getAttribute("type") || "TEXT").toUpperCase() : t,
                a = atts[i].getAttribute("jtk-att"),
                v = _rotors.data(data, a);

            if (v != null) {
                _setHandlers[tt](atts[i], v);
            }

            // ENABLE COMMIT VIA enter key.
            if (atts[i].getAttribute("jtk-commit")) {
                if (t === "INPUT") {
                    jsPlumb.on(atts[i], "keyup", function (e) {
                        if (e.keyCode == 10 || e.keyCode == 13)
                            _close();
                    });
                }
                else if (t === "TEXTAREA") {
                    jsPlumb.on(atts[i], "keyup", function (e) {
                        if (e.ctrlKey && (e.keyCode == 10 || e.keyCode == 13))
                            _close();
                    });
                }
            }
        }
    };

    var _setHandlers = {
        "TEXT": function (el, v) {
            el.value = v;
        },
        "RADIO": function (el, v) {
            el.checked = el.value == v;
        },
        "CHECKBOX": function (el, v) {
            el.checked = v == true;
        },
        "SELECT": function (el, v) {
            for (var i = 0; i < el.options.length; i++) {
                if (el.options[i].value == v) {
                    el.selectedIndex = i;
                    return;
                }
            }
        },
        "TEXTAREA": function (el, v) {
            el.value = v;
        }
    };

    var _getHandlers = {
        "TEXT": function (el) {
            return el.value;
        },
        "RADIO": function (el) {
            if (el.checked) return el.value;
        },
        "CHECKBOX": function (el) {
            if (el.checked) return true;
        },
        "SELECT": function (el) {
            return el.selectedIndex != -1 ? el.options[el.selectedIndex].value : null;
        },
        "TEXTAREA": function (el) {
            return el.value;
        }
    };

    var _clearHandlers = {
        "TEXT": function (el) {
            el.value = "";
        },
        "RADIO": function (el) {
            el.checked = false;
        },
        "CHECKBOX": function (el) {
            el.checked = false;
        },
        "SELECT": function (el) {
            el.selectedIndex = -1;
        },
        "TEXTAREA": function (el) {
            el.value = "";
        }
    };

    var _clear = function(els, source) {
        for (var i = 0; i < els.length; i++) {
            if (els[i] === source) continue;
            var t = els[i].tagName.toUpperCase(),
                tt = t === "INPUT" ? (els[i].getAttribute("type") || "TEXT").toUpperCase() : t,
                ch = _clearHandlers[tt];
            if (ch) {
                ch(els[i]);
            }
        }
    };

    var _getData = function () {
        var atts = content.querySelectorAll("[jtk-att]"),
            out = {};

        for (var i = 0; i < atts.length; i++) {
            var t = atts[i].tagName.toUpperCase(),
                tt = t === "INPUT" ? (atts[i].getAttribute("type") || "TEXT").toUpperCase() : t,
                v = _getHandlers[tt](atts[i]),
                a = atts[i].getAttribute("jtk-att");

            if (v != null) {
                var existing = _rotors.data(out, a);
                if (existing != null) {
                    if (!jsPlumbUtil.isArray(existing))
                        _rotors.data(out, a, [ existing ]);

                    existing.push(v);
                }
                else
                    _rotors.data(out, a, v);
            }
        }

        return out;

        // input of type text : value
        // textarea: value
        // input type radio: if checked, value
        // checkbox: value (create array if necessary)
        // select: value of selected option
        // multi select: array of values of selected options.
        // sliders etc. spinners etc.
    };

    var _proxy = function(fn, otherArguments) {
        try {
            if (fn != null)
                fn.apply(fn, Array.prototype.slice.apply(arguments, [1]));
        }
        catch (e) { }
    };

    var _close = function (wasCancelled) {

        var data = wasCancelled ? null : _getData() ;

        if (!wasCancelled && onMaybeClose != null && onMaybeClose(data) === false) return;

        visible = false;
        underlay.style.display = "none";
        overlay.style.display = "none";

        jsPlumb.off(document, "keyup", keyListener);
        // on window resize/scroll, ensure dialog stays in the middle.
        jsPlumb.off(window, "resize", _positionOverlay);
        jsPlumb.off(window, "scroll", _positionOverlay);

        jsPlumb.removeClass(overlay, "jtk-dialog-overlay-visible");
        jsPlumb.removeClass(overlay, "jtk-dialog-overlay-top");
        jsPlumb.removeClass(overlay, "jtk-dialog-overlay-bottom");
        jsPlumb.removeClass(overlay, "jtk-dialog-overlay-left");
        jsPlumb.removeClass(overlay, "jtk-dialog-overlay-right");
        jsPlumb.removeClass(overlay, "jtk-dialog-overlay-x");
        jsPlumb.removeClass(overlay, "jtk-dialog-overlay-y");
        overlay.setAttribute("data-position", "");
        overlay.setAttribute("data-axis", "");

        container.removeChild(underlay);
        container.removeChild(overlay);

        btnOk.parentNode.removeChild(btnOk);
        btnCancel.parentNode.removeChild(btnCancel);

        if (wasCancelled) {
            _proxy(globals.onCancel, content);
            _proxy(onCancel, content);
        }
        else {
            _proxy(globals.onOK, data, content);
            _proxy(onOK, data, content);
        }

        _proxy(globals.onClose);
        _proxy(onClose);


        onOK = onCancel = onOpen = onClose = onMaybeClose = current = null;
    };

    root.jsPlumbToolkit.Dialogs = {
        /**
         * Initialize all the dialogs found on the page.
         * @method jsPlumbToolkit.Dialogs.initialize
         * @param {Object} params Method parameters
         * @param {String} [params.selector='.jtk-dialog'] Selector identifying dialog elements. If not provded, the value '.jtk-dialog' is used by default.
         * @param {Object} [params.globals] Optional object of global callbacks, keyed by event id.
         * @param {Object} [params.labels] Optional object of button labels. See documentation.
         */
        initialize: function (params) {
            params = params || {};
            var sel = params.selector || ".jtk-dialog",
                els = jsPlumb.getSelector(sel);

            for (var i = 0; i < els.length; i++) {
                var id = els[i].getAttribute("id");
                if (id != null) {
                    cache[id] = {
                        content: els[i].innerHTML,
                        title: els[i].getAttribute("title") || "",
                        el: els[i],
                        cancelable: els[i].getAttribute("cancel") !== "false"
                    };
                }
            }

            // override default labels if labels provided
            if (params.labels) {
                jsPlumb.extend(labels, params.labels);
            }

            if (params.globals) {
                jsPlumb.extend(globals, params.globals);
            }
        },
        /**
         * Show the dialog with the given id, optionally rendering it with some provided data.
         * @method jsPlumbToolkit.Dialogs.show
         * @param {Object} params Method parameters
         * @param {String} params.id ID of the dialog to show
         * @param {Object} [params.data] Optional data to render the dialog template with.
         * @param {String} [params.title] Title for the dialog. If not supplied, the dialog's title will come from the `title` attribute of the associated template, if any. Otherwise it will be blank.
         * @param {Function} [params.onOpen] Optional function to run once the dialog has opened.
         * @param {Function} [params.onOK] Optional function to run when the user presses OK.
         * @param {Function} [params.onCancel] Optional function to run when the user presses cancel.
         * @param {Function} [params.onClose] Optional function to call when the dialog is closed, regardless of how it was closed.
         * @param {Function} [params.onMaybeClose] Optional function that will be called prior to `onOK` being called, with the same data that will be passed to `onOK`. Returning false from this function causes the dilaog to remain open.
         */
        show: _setCurrent,

        /**
         * Hide the current dialog as if the cancel button was pressed.
         * @method jsPlumbToolkit.Dialogs.hide
         */
        hide:function() { _close(true); },

        /**
         * Clears the given set
         */
        clear:_clear
    }

}).call(this);


/**
 * Optional extra functionality for use with the jsPlumb Toolkit. This provides a set of
 * drawing tools - select, drag, resize. Everything this tool adds to the UI has an associated
 * CSS class, so you can skin it very easily.
 */

;
(function () {
    "use strict";
    var root = this;

    /**
     * A set of drawing tools to use in conjunction with a Surface in the jsPlumb Toolkit.
     * @class jsPlumbToolkit.DrawingTools
     * @param params Constructor parameters.
     * @param {Surface} params.renderer Surface renderer to associate the tools with.
     * @param {String} [params.widthAttribute="w"] Name of the attribute used to store the node's width in its data.
     * @param {String} [params.heightAttribute="h"] Name of the attribute used to store the node's height in its data.
     * @param {String} [params.leftAttribute="left"] Name of the attribute used to store the node's left position in its data.
     * @param {String} [params.topAttribute="top"] Name of the attribute used to store the node's top position in its data.
     * @constructor
     */
    root.jsPlumbToolkit.DrawingTools = function (params) {

        var renderer = params.renderer,
            toolkit = renderer.getToolkit(),
            jsp = renderer.getJsPlumb(),
            skeletons = {},
            widthAtt = params.widthAttribute || "w",
            heightAtt = params.heightAttribute || "h",
            leftAtt = params.leftAttribute || "left",
            topAtt = params.topAttribute || "top",
            xAxis, yAxis;

        var _reset = function () {
            for (var id in skeletons) {
                var s = skeletons[id];
                if (s[0] && s[0].parentNode) {
                    s[0].parentNode.removeChild(s[0]);
                }
                delete skeletons[id];
            }
        };

        var _create = function (t, c, p, a) {
            var s = document.createElement(t);
            if (c) s.className = c;
            if (p) p.appendChild(s);
            if (a) {
                for (var i in a) {
                    s.setAttribute(i, a[i]);
                }
            }
            return s;
        };

        var _remove = function (id) {
            var s = skeletons[id];
            if (s && s[0] && s[0].parentNode) {
                s[0].parentNode.removeChild(s[0]);
            }
            delete skeletons[id];
        };

        var _deselect = function (node, renderer) {
            var el = renderer.getRenderedNode(node.id);
            _remove(node.id);
            return el;
        };

        var _select = function (node, renderer) {
            var el = _deselect(node, renderer);
            if (el != null) {
                var s = _create("div", "jtk-draw-skeleton", el),
                    x = el.getAttribute("jtk-x-resize"), y = el.getAttribute("jtk-y-resize");

                _create("div", "jtk-draw-drag", s);
                _create("div", "jtk-draw-handle jtk-draw-handle-tl", s, {"data-dir": "tl", "data-node-id": node.id });
                _create("div", "jtk-draw-handle jtk-draw-handle-tr", s, {"data-dir": "tr", "data-node-id": node.id });
                _create("div", "jtk-draw-handle jtk-draw-handle-bl", s, {"data-dir": "bl", "data-node-id": node.id });
                _create("div", "jtk-draw-handle jtk-draw-handle-br", s, {"data-dir": "br", "data-node-id": node.id });

                skeletons[node.id] = [ s, x !== "false", y !== "false" ];
            }
        };

        var downAt, handler, toolkitDragObject, x1, x2, y1, y2;

        var _dim = function (x, y, w, h) {
            var out = {};
            out[widthAtt] = xAxis ? w : (x2 - x1);
            out[heightAtt] = yAxis ? h : (y2 - y1);
            out[leftAtt] = xAxis ? x : x1;
            out[topAtt] = yAxis ? y : y1;
            return out;
        };

        var _dragHandlers = {
            "tl": function (dx, dy) {
                var x = x1 + dx, y = y1 + dy, w = x2 - x, h = y2 - y;
                if (x >= x2) {
                    w = x - x2;
                    x = x2;
                }

                if (y >= y2) {
                    h = y - y2;
                    y = y2;
                }

                return _dim(x, y, w, h);
            },
            "tr": function (dx, dy) {
                var w = (x2 - x1) + dx, y = y1 + dy, h = y2 - y, x = x1;
                if (w <= 0) {
                    x = x1 + w;
                    w *= -1;
                }

                if (y >= y2) {
                    h = y - y2;
                    y = y2;
                }

                return _dim(x, y, w, h);
            },
            "bl": function (dx, dy) {
                var x = x1 + dx, h = (y2 - y1) + dy, w = x2 - x, y = y1;
                if (x >= x2) {
                    w = x - x2;
                    x = x2;
                }
                if (h <= 0) {
                    y += h;
                    h *= -1;
                }
                return _dim(x, y, w, h);
            },
            "br": function (dx, dy) {
                var w = (x2 - x1) + dx, h = (y2 - y1) + dy, x = x1, y = y1;
                if (w <= 0) {
                    x = x1 + w;
                    w *= -1;
                }

                if (h <= 0) {
                    y += h;
                    h *= -1;
                }

                return _dim(x, y, w, h);
            }
        };

        toolkit.bind("selectionCleared", function () {
            _reset();
        });

        // - on select, add drawing primitives
        toolkit.bind("select", function (params) {
            _select(params.obj, renderer);
        });

        // - on deselect, remove drawing primitives.
        toolkit.bind("deselect", function (params) {
            _deselect(params.obj, renderer);
        });

        var moveListener = function (e) {
            var p = renderer.mapEventLocation(e),
                editingDx = (p.left - downAt.left),
                editingDy = (p.top - downAt.top);

            var newCoords = handler(editingDx, editingDy, "");
            toolkit.updateNode(toolkitDragObject, newCoords);
            renderer.setPosition(toolkitDragObject, newCoords[leftAtt], newCoords[topAtt], true);
        };

        var upListener = function (e) {
            renderer.storePositionInModel(toolkitDragObject.id);
            jsp.removeClass(document.body, "jtk-draw-select-defeat");
            jsp.off(document, "mousemove", moveListener);
            jsp.off(document, "mouseup", upListener);
            jsPlumbUtil.consume(e);
        };

        // - delegate bind to drag handles
        jsp.on(document, "mousedown", ".jtk-draw-handle", function (e) {
            var dir = this.getAttribute("data-dir"),
                nodeId = this.getAttribute("data-node-id");

            toolkitDragObject = toolkit.getNode(nodeId);
            xAxis = skeletons[nodeId][1];
            yAxis = skeletons[nodeId][2];

            downAt = renderer.mapEventLocation(e);
            // get the location and size of the element
            var c = renderer.getCoordinates(toolkitDragObject);
            x1 = c.x;
            y1 = c.y;
            x2 = x1 + c.w;
            y2 = y1 + c.h;

            handler = _dragHandlers[dir];

            jsp.addClass(document.body, "jtk-draw-select-defeat");

            jsp.on(document, "mousemove", moveListener);
            jsp.on(document, "mouseup", upListener);
        });

    };

}).call(this);