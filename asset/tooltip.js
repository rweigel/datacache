function tooltip(el) {

	$(el).hover(
		function () {
				$(this).children(".tooltip").eq(0).remove();
				$(this).attr('tooltip',($(this).attr('title') || "") + ($(this).attr('tooltip')||""));
				$(this).attr('title','');
				var str = $(this).attr("title") + ($(this).attr("tooltip") || "");
				$(this).append("<span class='tooltip'>"+str.replace(/ /g,'&nbsp;')+"</span>");
				if (str === "")
					$(this).children(".tooltip").css('display','none');
				var offset = $(this).offset();
				$(this).children(".tooltip").eq(0).offset({ top: offset.top+15, left: offset.left});
				$(this).children(".tooltip").eq(0).mouseover(function () {$(this).hide()});
		},
		function () {												
			$(this).children(".tooltip").css('display','none');
		}
	)

	
}