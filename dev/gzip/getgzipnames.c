#include<stdio.h>
//Program to extract filenames from concatenated gzip file headers
//Gzip specification: http://www.gzip.org/zlib/rfc-gzip.html

struct head
{
	char id1,id2,cm,flag;
	int mtime;
	char xfl,os;
};

void c2b(int *bits, char x)
{
	int i=0;
	for(i=0;i<8;i++)
	{
		bits[i]=((x>>i)&1);
	}
}

int main(int argc, char **argv){

	FILE *ptr_file;
	struct head header;
	int bits[8]={0};
	short xlen;
	char* trash;
	char buffer='a';
	int filenum=1;
	char flag;
	char* filename;

	if(argc>1)
	{
		filename=argv[1];
	}
	else
	{
		printf("Usage:\n ./getgzipnames \"filename.gz\" ");
		return 1;
	}
	


	ptr_file=fopen(filename,"rb");
	if(!ptr_file)
	{
		printf("Can't open file\n");
		return 1;
	}

	while(!feof(ptr_file))
	{
		fread(&buffer,sizeof(char),1,ptr_file);
		//printf("%d ",buffer);
		if(buffer==31) //If you found header
		{
			fread(&buffer,sizeof(char),1,ptr_file);
			//printf("%d ",buffer);
			if(buffer==139 || buffer==-117)
			{
				//Should have found start of next header
				fread(&trash,sizeof(char),1,ptr_file);
				fread(&flag,sizeof(char),1,ptr_file);
				c2b(bits,flag);
				fread(&trash,sizeof(char)*6,1,ptr_file); //Read out the rest of the header

				if(bits[2]==1) //If FEXTRA set, read a short with length, then throw away that length to get to filename
				{
					printf("Reading FEXTRA\n");
					fread(&xlen,sizeof(short),1,ptr_file);
					fread(&trash,xlen*sizeof(char),1,ptr_file);
				}

				//IMPORTANT: If you use fread(&header, sizeof(struct head),1,ptr_file); instead of individual pieces,
				//sizeof(struct) pads the structure with two extra bits. You must go back two bits to undo it.
				//Other option is to tell the compiler not to pad a struct, but appears to be highly compiler/system dependent
				//fseek(ptr_file,sizeof(struct head)-2*sizeof(char),SEEK_SET);

				//Should be at the first filename now
				printf("Reading filename %d:\n", filenum);
				while(buffer!=0)
				{
					fread(&buffer,sizeof(char),1,ptr_file);
					printf("%c",buffer);
				}
				printf("\n");
				filenum++;
			}
		}

	}
	fclose(ptr_file);

	//printf("%c %c %c %c %d %c %c\n",header.id1,header.id2,header.cm,header.flag,header.mtime,header.xfl,header.os);

	//printf("int %d unsint %d char %d unschar %d\n",sizeof(int),sizeof(unsigned int),sizeof(char),sizeof(unsigned char));


}
