//
// Copyright (c) Autodesk, Inc. All rights reserved
//
// Large Model Viewer Extractor
// by Cyrille Fauvel - Autodesk Developer Network (ADN)
// January 2015
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
//
jsPlumb.bind ('jsPlumbLoaded', function (instance) {
	var renderer =jsPlumbToolkit.Support.ingest ({ jsPlumb: instance }) ;
	// bind to the node added event and tell the renderer to ingest each one
	instance.bind ('jsPlumbNodeAdded', function (el) { renderer.ingest (el) ; }) ;
}) ;

jsPlumb.ready (function () {
	// Setup some defaults for jsPlumb.
	var instance =jsPlumb.getInstance ({
		Endpoint: [ 'Dot', { radius: 2 } ],
		Connector: 'StateMachine',
		HoverPaintStyle: { strokeStyle: '#1e8151', lineWidth: 2 },
		ConnectionOverlays: [
			[ 'Arrow', {
				location: 1,
				id: 'arrow',
				length: 14,
				foldback: 0.8
			} ]
			//[ "Label", { label: "FOO", id: "label", cssClass: "aLabel" }]
		],
		Container: 'dependencyEditorCanvas'
	}) ;

	instance.registerConnectionType ('basic', { anchor: 'Continuous', connector: 'StateMachine' }) ;
	window.jsp =instance ;

	// Bind a click listener to each connection; the connection is deleted. you could of course
	// just do this: jsPlumb.bind("click", jsPlumb.detach), but I wanted to make it clear what was
	// happening.
	instance.bind ('click', function (c) { instance.detach (c) ; }) ;
	// Bind a connection listener. note that the parameter passed to this function contains more than
	// just the new connection - see the documentation for a full list of what is included in 'info'.
	// this listener sets the connection's internal
	// id as the label overlay's text.
	instance.bind ('connection', function (info) {
		//info.connection.getOverlay ("label").setLabel (info.connection.id) ;
	}) ;
	instance.bind ('connectionDetach', function () {}) ;
	// Bind a double click listener to "dependencyEditorCanvas"; add new node when this occurs.
	//var dependencyEditorCanvas =$("#dependencyEditorCanvas") ;
	//jsPlumb.on (dependencyEditorCanvas, "dblclick", function (e) {
	//	_addJsPlumbNode (e.offsetX, e.offsetY, 'dblclick') ;
	//}) ;

	// Suspend drawing and initialize.
	var windows =jsPlumb.getSelector ('.statemachine .w') ;
	instance.batch (function () {
		//for ( var i =0 ; i < windows.length; i++ )
		//	_initJsPlumbNode (windows [i], true) ;
	}) ;

	jsPlumb.fire ('jsPlumbLoaded', instance) ;
}) ;

// Initialise element as connection targets and source.
function _initJsPlumbNode (el) {
	// Initialise draggable elements.
	window.jsp.draggable (el) ;
	window.jsp.makeSource (el, {
		filter: '.ep',
		anchor: 'Continuous',
		connectorStyle: { strokeStyle: '#5c96bc', lineWidth: 2, outlineColor: 'transparent', outlineWidth: 4 },
		connectionType: 'basic',
		extract: {
			"action": 'the-action'
		}
		/*maxConnections: 2,
		 onMaxConnections: function (info, e) {
		 alert("Maximum connections (" + info.maxConnections + ") reached");
		 }*/
	}) ;
	window.jsp.makeTarget (el, {
		dropOptions: { hoverClass: 'dragHover' },
		anchor: 'Continuous',
		allowLoopback: true
		/*maxConnections: 5,
		 onMaxConnections: function (info, e) {
		 alert("Maximum connections (" + info.maxConnections + ") reached");
		 }*/
	}) ;

	// This is not part of the core demo functionality; it is a means for the Toolkit edition's wrapped
	// version of this demo to find out about new nodes being added.
	window.jsp.fire ('jsPlumbNodeAdded', el [0]) ;
}

function _addJsPlumbNode  (x, y, label, id) {
	id =id || jsPlumbUtil.uuid () ;
	var d =$(document.createElement ('div'))
		.addClass ('w')
		.addClass ('jtk-node')
		.prop ('id', id)
		.text (label || 'test')
		.css ('left', x + 'px')
		.css ('top', y + 'px')
		.appendTo (window.jsp.getContainer ()) ;
	var ep =$(document.createElement ('div'))
		.addClass ('ep')
		.prop ('action', id)
		.appendTo (d) ;
	_initJsPlumbNode (d) ;
	return (d) ;
}

function addJsPlumbNode (file) {
	//file.uniqueIdentifier/ file.name
	return (_addJsPlumbNode  (0, 0, file.name, file.uniqueIdentifier)) ;
}

function connectJsPlumbNodes (node1, node2) {
	window.jsp.connect ({ source: node1 [0], target: node2 [0], type: 'basic' }) ;
}

// http://onais-m.blogspot.co.uk/2014/10/automatic-graph-layout-with-javascript.html
function autoArrangeJsPlumb () {
	//var nodes =window.jsp.getSelector ('.statemachine .w') ;
	//var edges =window.jsp.getAllConnections () ;
	window.jsp.batch (function () {
		// If a node does not have any parent, then assume it will soon be the 1st one linked to the 'Lmv Root' node
		//var defaultParent =$('.statemachine .rootc') [0].id ;

		// Construct dagre graph from JsPlumb graph
		var config ={
			nodesep: 50,
			edgesep: 20,
			ranksep: 60
		} ;
		var g =new dagre.graphlib.Graph () ;
		g.setGraph (config) ;
		g.setDefaultEdgeLabel (function () { return ({}) ; }) ;
		var nodes =$('.statemachine .w') ;
		for ( var i =0 ; i < nodes.length ; i++ ) {
			var n =nodes [i] ;
			g.setNode (n.id, { width: $(n).width (), height: $(n).height () }) ;
		}
		var edges =window.jsp.getAllConnections () ;
		for ( var i =0 ; i < edges.length ; i++ ) {
			var c =edges [i] ;
			g.setEdge (c.source.id, c.target.id) ;
		}
		//for ( var i =0 ; i < nodes.length ; i++ ) {
		//	var n =nodes [i] ;
		//	var sConns =window.jsp.getConnections ({ target: n.id, scope: '*'}, true) ;
		//	//if ( sConns.length == 0 && n.id != 'lmv-root' ) {
		//	//	window.jsp.connect ({ source: defaultParent, target: n.id }) ;
		//	//	g.setEdge (defaultParent, n.id) ;
		//	//}
		//}
		// Calculate the layout (i.e. node positions)
		dagre.layout (g, config) ;
		// Applying the calculated layout
		var box ={ left: 1000000, top: 10000000, right: 0, bottom: 0 } ;
		g.nodes ().forEach (function (v) {
			box.left =Math.min (g.node (v).x, box.left) ;
			box.right =Math.max (g.node (v).x, box.right) ;
			box.top =Math.min (g.node (v).y, box.top) ;
			box.bottom =Math.max (g.node (v).y, box.bottom) ;
		}) ;
		var w2 =$('#dependencyEditorCanvas').width () / 2 ;
		var offsetx =w2 - (box.right - box.left) / 2 ;
		var offsety =75 ;
		g.nodes ().forEach (function (v) {
			$('#' + v).css ('left', (g.node (v).x + offsetx) + 'px') ;
			$('#' + v).css ('top', (g.node (v).y + offsety) + 'px') ;
		}) ;

		//window.jsp.repaintEverything () ;
	}) ;
}

function buildDependencyTree (tree) {
	var nodes ={} ;
	$.each (tree, function (index, item) {
		var id =$(item.source).prop ('id').replace (/^flow-file-/, '') ;
		if ( !nodes.hasOwnProperty (id) ) {
			nodes [id] ={
				'name': $(item.source).text (),
				'uniqueIdentifier': id,
				'children': []
			} ;
		}
		var id2 =$(item.target).prop ('id').replace (/^flow-file-/, '') ;
		if ( !nodes.hasOwnProperty (id2) ) {
			nodes [id2] ={
				'name': $(item.target).text (),
				'uniqueIdentifier': id2,
				'children': []
			} ;
		}
		nodes [id].children.push (nodes [id2]) ;
		nodes [id2].parent =nodes [id] ;
	}) ;
	var key =Object.keys (nodes).filter (function (elt) { return (!nodes [elt].hasOwnProperty ('parent')) ; }) ;
	Object.keys (nodes).map (function (elt) { delete nodes [elt] ['parent'] ; return (nodes [elt]) ; })
	return (nodes [key]) ;
}
