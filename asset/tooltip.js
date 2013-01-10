function tooltip(el) {

	$(el).hover(
		function () {
			$(this).children(".tooltip").remove();
			$(this).attr('tooltip',$(this).attr('title') + ($(this).attr('tooltip')||""));
			$(this).attr('title','');
			var str = $(this).attr("title") + ($(this).attr("tooltip")||"");
			$(this).append("<span class='tooltip'>"+str+"</span>");
			var offset = $(this).offset();
			$(this).children(".tooltip").offset({ top: offset.top-25, left: offset.left});
		},
		function () {												
			$(this).children(".tooltip").css('display','none');
		}
	)

	
}