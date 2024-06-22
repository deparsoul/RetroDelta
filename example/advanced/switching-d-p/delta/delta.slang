#version 450

layout(push_constant) uniform Push
{
	vec4 OutputSize;
	vec4 SourceSize;
	vec4 OriginalSize;
} params;

// portrait mode
vec2 p_border_size = vec2(1290, 2797);
vec2 p_screen_size = vec2(1290, 870);
vec2 p_screen_offset = vec2(0, 259);

// landscape mode
vec2 l_border_size = vec2(0, 0);
vec2 l_screen_size = vec2(0, 0);
vec2 l_screen_offset = vec2(0, 0);

layout(std140, set = 0, binding = 0) uniform UBO
{
   mat4 MVP;
} global;

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 border_coord;
layout(location = 1) out vec2 screen_coord;

void main()
{
	gl_Position	 =	global.MVP * Position;

	bool is_landscape = l_border_size.x > 0 && params.OutputSize.x > params.OutputSize.y;

	vec2 border_size 	= is_landscape ? l_border_size : p_border_size;
	vec2 screen_size 	= is_landscape ? l_screen_size : p_screen_size;
	vec2 screen_offset 	= is_landscape ? l_screen_offset : p_screen_offset;

	vec2 scale = params.OutputSize.xy / border_size;
	scale = scale / min(scale.x, scale.y);

	vec2 middle = vec2(0.5, 0.5);
	border_coord =	TexCoord.xy;
	// border_coord = (border_coord - middle) * scale + middle; // keep aspect ratio
	screen_coord =	(border_coord * border_size - screen_offset) / screen_size;
}

#pragma stage fragment
layout(location = 0) in vec2 border_coord;
layout(location = 1) in vec2 screen_coord;
layout(location = 0) out vec4 FragColor;
layout(set = 0, binding = 2) uniform sampler2D Source;

void main()
{
	vec4 frame	=	texture(Source, screen_coord).rgba;
	FragColor	=	frame;
}
